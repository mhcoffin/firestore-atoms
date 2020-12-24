import {atom, PrimitiveAtom, WritableAtom} from "jotai";
import firebase from 'firebase/app'
import {Getter, SetStateAction, Setter} from "jotai/core/types";
import {useAtomCallback} from "jotai/utils.cjs";
import {useEffect} from "react";

type DocumentReference = firebase.firestore.DocumentReference

// Creates a firestore atom that mirrors the specified firestore document,
// as well as a subscriber function that can be invoked to subscribe to
// firestore and keep the atom up-to-date.
//
// The returned atom will initially be suspended for both read and write.
// When the subscriber has retrieved the page from firestore for the first time,
// the promise resolves. Thereafter, the atom acts like a normal PrimitiveAtom<T>.
// Reading from it will return the current value of the firestore document.
// Updating it will modify the firestore document. Remote updates to the atom
// page will cause the atom to update.
//
// The returned subscriber should be activated in some react component via the hook:
//
//   useFirestoreSubscriber(subscriber)
//
// The subscription will be established when the component is mounted and cancelled
// when the component is dismounted. The subscription must be in from a component
// that does not actually use the value of atom. If you try to use the atom value
// from the same react component that subscribes to it, it will suspend before it
// gets a chance to subscribe.
//
// The subscriber tries to be smart about updating the atom: when a new value is set,
// either because of a remote update or a local one, the atom value is updated
// while maintaining as much of the old structure as possible. This helps
// eliminate unnecessary re-rendering.
//
// Options:
//
// If options.typeGuard is specified, it is applied to values read from firestore. If
// the type guard returns false, an error is thrown. If no typeGuard is specified,
// pages from firestore are simply coerced to type T without any checking.
//
// If options.fallback is specified, attempting to read a doc that does not exist will
// write the fallback value to firestore. If no fallback is specified, trying to read
// a doc that does not exist causes an error to be thrown.
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
        const v = get(store)
        if (v === pending) {
          return new Promise(resolve => {
            const getter = () => {
              resolve(get(store) as T)
            }
            waiters.push(getter)
          })
        } else {
          return v
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
                doc.set(value)
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
      // TODO reset atom?
      unsubscribe()
    }
  }
  return [fsAtom, subscriber]
}

export type Subscriber = (get: Getter, set: Setter) => () => void

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

// Convert Timestamp(0, 0) to serverTimestamp()
const fixTimestamps = (x: any): any => {
  if (x instanceof firebase.firestore.Timestamp) {
    if (x.seconds === 0 && x.nanoseconds === 0) {
      return firebase.firestore.FieldValue.serverTimestamp()
    }
  } else if (typeof x === 'object') {
    const r: Record<string, any> = {}
    for (const [key, value] of Object.entries(x)) {
      r[key] = fixTimestamps(value)
    }
    return r
  } else {
    return x
  }
}

// Given the previous version of an object and the current version, updateConservatively
// generates an object that is deep-equal to curr, but conserves as much structure as
// possible from prev. E.g., if curr is itself deep-equal to prev, then the result is
// exactly prev. Or, suppose that prev is an object with a number of keys, and suppose
// that curr is a copy of prev, but with the value of one key, say K, changed. Then the
// result will be {...prev, K: curr.K}. This means that any selectors (say) that depend
// on keys other than K will not require an update, even using object equality.
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

export const testable = {
  deq, updateConservatively, fixTimestamps
}
