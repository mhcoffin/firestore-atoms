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
// The returned atom will initially be suspended I.e., will be an unresolved
// promise. When the first value is retrieved from firestore, the promise resolves.
// Thereafter, the atom acts like a normal PrimitiveAtom<T>. Reading from it
// will return the current value of the firestore document; updating it will
// modify the firestore document.
//
// The returned subscriber should be activated via the hook:
//
//   useFirestoreSubscriber(subscriber)
//
// The subscription will be established when the component is mounted and cancelled
// when the component is dismounted. The subscription must be done from a component
// that does not actually use the value of atom: if you try to use the atom value
// from the same component, it will suspend before it actually subscribes, leading to
// deadlock.
//
// The subscriber is smart about updating the atom: when a new value comes in,
// either because of a remote update or a local one, the subscriber updates the
// atom while maintaining as much of the old structure as possible. This helps
// eliminate needless re-rendering.
//
// If the optional 'isT' function is supplied, it is used to verify that values coming
// from firestore are actually of type T. I.e., isT should be a type guard for T.
//
export const firestoreAtom = <T>(
    doc: DocumentReference,
    isT?: (x: any) => boolean): [PrimitiveAtom<T>, Subscriber] => {
  const pending = Symbol()
  const store = atom<T | typeof pending>(pending)
  const getters: ((value: T) => void)[] = []

  const fsAtom: WritableAtom<T, SetStateAction<T>> = atom(
      (get) => {
        const v = get(store)
        if (v === pending) {
          return new Promise(resolve => getters.push(resolve))
        } else {
          return Promise.resolve(v)
        }
      },
      async (get, set, update: SetStateAction<T>) => {
        console.log(`setting...`)
        const prev = get(store)
        const base = prev === pending ? {} as T : prev
        const value = update instanceof Function ? update(base) : update
        try {
          await doc.set(value)
        } catch (error) {
          throw new Error(`failed to update page: ${error.message}`)
        }
      }
  )

  const subscriber = (get: Getter, set: Setter) => {
    const unsubscribe = doc.onSnapshot(snap => {
      const incoming = snap.data({serverTimestamps: 'estimate'}) as T
      if (isT && !isT(incoming)) {
        throw new Error(`value read from firestore does not satisfy type guard`)
      }
      const prev = get(store)
      const next = updateConservatively(prev === pending ? {} : prev, incoming)
      set(store, next)
      while (getters.length > 0) {
        const getter = getters.shift()
        if (getter) getter(next as T)
      }
    })
    return () => {
      // TODO reset atom?
      unsubscribe()
    }
  }
  return [fsAtom, subscriber]
}

type Subscriber = (get: Getter, set: Setter) => () => void

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

// Given the previous version of an object and the current version, updateCarefully
// generates an object that is deep-equal to curr, but shares as much structure as
// possible with prev. If curr is itself deep-equal to prev, then the result is
// exactly prev. Or, suppose that prev is an object with a number of keys, and suppose
// that curr is a copy of prev, but with the value of one key, say K, changed. Then the
// result will be a new object. The new object will have the same keys as curr. The
// values for each key other than K are taken from curr; those objects will be === to
// the parallel objects in curr. The value for K will be === to the K-subtree of curr.
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
  deq, updateConservatively
}
