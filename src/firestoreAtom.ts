import {atom, PrimitiveAtom, WritableAtom} from "jotai";
import firebase from 'firebase/app'
import 'firebase/firestore'
import {Getter, SetStateAction, Setter} from "jotai/core/types";
import {useAtomCallback} from "jotai/utils.cjs";
import {useEffect} from "react";

type DocumentReference = firebase.firestore.DocumentReference

/** Use this Timestamp to set a server timestamp exactly once and never update */
export const CREATE_TS = new firebase.firestore.Timestamp(1, 1)

/** Use this Timestamp to set a server timestamp on every write. */
export const MODIFY_TS = new firebase.firestore.Timestamp(1, 2)

/**
 * Creates a firestore atom that mirrors the specified firestore document,
 * as well as a subscriber function that can be invoked to subscribe to
 * firestore and keep the atom up to date. The intent is that the atom
 * mirrors the value in firestore as long as the subscriber is active.
 *
 * The returned atom will initially be suspended for both read and write
 * until the subscriber fires. When the subscriber has retrieved the page
 * from firestore for the first time, the promise resolves. Thereafter,
 * the atom acts like a normal PrimitiveAtom<T>. Reading from it will
 * return the current value of the firestore document. Updating it will
 * modify the firestore document (suspending briefly). Remote updates to
 * the atom page will cause the atom to update.
 *
 * The returned subscriber should be activated in some react component via
 * the hook:
 *
 *   useFirestoreSubscriber(subscriber)
 *
 * The subscription will be established when the component is mounted and
 * cancelled when the component is dismounted. The subscription must be
 * established in a component that does not actually use the value of atom.
 * If you try to use the atom value from the same react component that
 * subscribes to it, it will suspend before it gets a chance to subscribe
 * and you will be stuck on the Suspense fallback page.
 *
 * The subscriber tries to be smart about updating the atom: when a new value
 * is set, either because of a remote update or a local one, the atom value
 * is updated while maintaining as much of the old structure as possible.
 * This helps eliminate unnecessary re-rendering.
 *
 * Options:
 *
 * If options.typeGuard is specified, it is applied to values read from
 * firestore. If the type guard returns false, an error is thrown. If no
 * typeGuard is specified, pages from firestore are simply coerced to type
 * T without any checking and you're on your own.
 *
 * If options.fallback is specified, attempting to read a doc that does not
 * exist will write the fallback value to firestore. If no fallback is
 * specified, trying to read a doc that does not exist causes an error to
 * be thrown.
 *
 * @param doc
 * @param options
 */
export const firestoreAtom = <T>(
    doc: DocumentReference,
    options: {
      typeGuard?: (x: any) => boolean,
      fallback?: T,
    } = {},
): [PrimitiveAtom<T>, Subscriber] => {
  const pending = Symbol()
  const store = atom<T | typeof pending>(pending)
  // Queue of pending readers and writers.
  const waiters: (() => void)[] = []

  const fsAtom: WritableAtom<T, SetStateAction<T>> = atom(
      (get) => {
        const value = get(store)
        if (value === pending) {
          return new Promise(resolve => {
            const getter = () => {
              resolve(get(store) as T)
            }
            waiters.push(getter)
          })
        } else {
          return value
        }
      },
      async (get, set, update: SetStateAction<T>) => {
        const prev = get(store)
        if (prev === pending) {
          return new Promise(resolve => {
            const setter = () => {
              const base = get(store) as T
              const value = update instanceof Function ? update(base) : update
              try {
                doc.update(firestoreDiff(base, value))
              } catch (err) {
                throw new Error(`failed to update page: ${err.message}`)
              }
              resolve()
            }
            waiters.push(setter)
          })
        } else {
          const value = update instanceof Function ? update(prev) : update
          try {
            await doc.set(value)
          } catch (err) {
            throw new Error(`failed to update page: ${err.message}`)
          }
        }
      }
  )

  const subscriber = (get: Getter, set: Setter) => {
    const unsubscribe = doc.onSnapshot(async snap => {
      if (!snap.exists) {
        if (options.fallback) {
          try {
            await doc.set(options.fallback)
            return
          } catch (err) {
            throw new Error(`failed to write fallback value to firestore: ${err.message}`)
          }
        } else {
          throw new Error(`specified doc does not exist and no fallback was specified`)
        }
      }
      const incoming = snap.data({serverTimestamps: 'estimate'})
      if (options.typeGuard && !options.typeGuard(incoming)) {
        throw new Error(`firestore page (or fallback) does not satisfy type guard`)
      }
      const prev = get(store)
      const next = (prev === pending) ? (incoming as T) : updateConservatively(prev, incoming)
      set(store, next)
      while (waiters.length > 0) {
        const waiter = waiters.shift()
        if (waiter) waiter()
      }
    })
    return () => {
      unsubscribe()
      set(store, pending)
    }
  }
  return [fsAtom, subscriber]
}

export type Subscriber = (get: Getter, set: Setter) => () => void

/**
 * Hook to use a Subscriber returned from firebaseAtom. Don't use the value
 * of the atom in the same component or you will be stuck on the fallback
 * page.
 *
 * @param subscriber returned from firestoreAtom()
 */
export const useFirestoreSubscriber = (subscriber: Subscriber) => {
  const cb = useAtomCallback(subscriber)
  useEffect(() => {
    try {
      (async () => await cb())()
    } catch (err) {
      throw new Error(`firestore subscription failed: ${err.message}`)
    }
  }, [cb])
}

/**
 * @param prev old verion of a JSON-ish object
 * @param curr revised version
 *
 * Given the previous version of an object and the current version,
 * updateConservatively generates an object that is deep-equal to curr,
 * but conserves as much structure as possible from prev.
 */
export const updateConservatively = (prev: any, curr: any) => {
  if (typeof prev !== typeof curr) {
    return curr
  }
  if (deq(prev, curr)) return prev
  const tp = typeof prev
  switch (tp) {
    case 'string':
    case 'number':
    case 'boolean':
    case 'symbol':
    case 'function':
    case 'bigint':
      return curr
    default: // Object
      const result: Record<string, any> = {}
      for (const [key, value] of Object.entries(prev)) {
        if (curr.hasOwnProperty(key)) {
          result[key] = updateConservatively(value, curr[key])
        }
      }
      for (const [key, value] of Object.entries(curr)) {
        if (!prev.hasOwnProperty(key)) {
          result[key] = value
        }
      }
      return result
  }
}

// Specialized deep-equal function.
export const deq = (a: any, b: any) => {
  if (a === b) return true
  if (typeof a !== typeof b) return false
  switch (typeof a) {
    case 'number':
    case 'string':
    case 'boolean':
    case 'bigint':
    case 'symbol':
    case 'function':
    case 'undefined':
      return a === b
  }
  // It's an object.
  if (a === null || b === null) {
    return false
  }
  if (Object.keys(a).length !== Object.keys(b).length) return false;
  for (const [key, value] of Object.entries(a)) {
    if (!b.hasOwnProperty(key)) return false
    if (!deq(value, b[key])) return false
  }
  return true
}

/**
 * Creates a diff object that can be applied to a firestore page via update().
 * The resulting diff will update the page to match 'after', except for two
 * special timestamps that can be included in 'after':
 *
 * - If 'after' contains an entry with value CREATE_TS, this field will be
 * omitted in the diff if 'before' already contains a timestamp in the parallel
 * entry. Thus CREATE_TS will create a timestamp the first time it's used,
 * but not change an existing timestamp.
 *
 * - If 'after' contains an entry with value MODIFY_TS, the diff will contain
 * FieldValue.serverTimestamp() so that the timestamp is updated to server time
 * on every write.
 *
 * @param before
 * @param after
 */
const firestoreDiff = (before: any, after: any): Record<string, any> => {
  const diff: Map<string, any> = new Map<string, any>()
  recFirestoreDiff(before, after, [], diff)
  return Object.fromEntries(diff.entries())
}

const recFirestoreDiff = (a: any, b: any, path: string[], diff: Map<string, any>) => {
  switch (typ(b)) {
    case 'error':
      throw new Error(`illegal firebase object at ${path.join('.')}`)
    case 'leaf':
      if (a !== b) {
        diff.set(path.join('.'), b)
      }
      return
    case 'createTime':
      if (typ(a) !== 'timestamp') {
        diff.set(path.join('.'), firebase.firestore.FieldValue.serverTimestamp())
      }
      return;
    case "modifyTime":
      diff.set(path.join('.'), firebase.firestore.FieldValue.serverTimestamp())
      return
    case 'timestamp': {
      const bb = b as firebase.firestore.Timestamp
      if (!(a instanceof firebase.firestore.Timestamp) || !a.isEqual(bb)) {
        diff.set(path.join('.'), b)
      }
      return
    }
    case 'undefined':
      if (a !== undefined) {
        diff.set(path.join('.'), firebase.firestore.FieldValue.delete())
      }
      return
    case 'object':
      switch (typ(a)) {
        case 'leaf':
        case 'timestamp':
        case 'createTime':  // probably cannot occur
        case 'modifyTime':  // ditto
        case 'error':       // ditto
          diff.set(path.join('.'), b)
          return
        case 'object':
          for (const [key, value] of Object.entries(a)) {
            if (b.hasOwnProperty(key)) {
              recFirestoreDiff(value, b[key], [...path, key], diff)
            } else {
              diff.set([...path, key].join('.'), firebase.firestore.FieldValue.delete())
            }
          }
          for (const [key, value] of Object.entries(b)) {
            if (!a.hasOwnProperty(key)) {
              diff.set([...path, key].join('.'), value)
            }
          }
      }
  }
}

const typ = (obj: any) => {
  switch (typeof obj) {
    case 'number':
    case 'string':
    case 'boolean':
    case 'bigint':
      return 'leaf'
    case 'undefined':
      return 'undefined'
    case 'symbol':
    case 'function':
      return 'error'
    case 'object':
      if (obj instanceof firebase.firestore.Timestamp) {
        if (obj.seconds === CREATE_TS.seconds && obj.nanoseconds === CREATE_TS.nanoseconds) {
          return 'createTime'
        } else if (obj.seconds === MODIFY_TS.seconds && obj.nanoseconds === MODIFY_TS.nanoseconds) {
          return 'modifyTime'
        } else {
          return 'timestamp'
        }
      }
      return 'object'
  }
}

export const testable = {
  deq, updateConservatively, firestoreDiff
}
