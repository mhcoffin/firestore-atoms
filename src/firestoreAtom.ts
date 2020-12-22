import {PrimitiveAtom} from "jotai";
import firebase from 'firebase/app'
import {suspenseAtom} from "./suspenseAtom";
import {Getter, Setter} from "jotai/core/types";
import {useAtomCallback} from "jotai/utils.cjs";
import {useEffect} from "react";

// Creates a firestore atom that mirrors the specified doc, as well as
// a subscriber function that can be used to subscribe to firestore and
// keep the atom up-to-date.
//
// The returned atom will initially be suspended (i.e., will be an unresolved
// promise) so you need to use <Suspense> to handle that. When the first value
// is retrieved from firestore, the promise resolves. Thereafter, the atom acts
// like a normal PrimitiveAtom<T>. Reading from it will return the current value
// of the firestore document; updating it will modify the firestore document.
//
// The returned subscriber should be invoked from useEffect() in a react component.
// The subscription will be established when the component is mounted and cancelled
// when the component is dismounted. Invocation is slightly tricky because use need
// to use 'useAtomCallback':
//
//   const subscriber = useAtomCallback(userInfoUpdater)
//   useEffect(() => {
//     (async () => await subscriber())()
//   }, [subscriber])
//
// The subscriber is smart about updating the atom: when a new value comes in,
// either because of a remote update or a local one, the subscriber updates the
// atom while maintaining as much of the old structure as possible. This helps
// eliminate needless re-rendering.
//
export const firestoreAtom = <T>(doc: firebase.firestore.DocumentReference):
    [PrimitiveAtom<T>, (get: Getter, set: Setter) => () => void] => {
  const store = suspenseAtom<T>({} as T)

  const subscriber = (get: Getter, set: Setter) => {
    const unsubscribe = doc.onSnapshot(snap => {
      const next = snap.data({serverTimestamps: 'estimate'}) as T
      set(store, prev => updateCarefully(prev, next))
    })
    return () => {
      // TODO reset atom?
      unsubscribe()
    }
  }

  return [store, subscriber]
}

export const useFirestoreSubscriber = (subscriber: (get: Getter, set: Setter) => () => void) => {
  const cb = useAtomCallback(subscriber)
  useEffect(() => {
    (async () => await cb())()
  }, [subscriber])
}

export const updateCarefully = (prev: any, next: any) => {
  if (typeof prev !== typeof next) {
    return next
  }
  if (deepEqual(prev, next)) return prev
  const tp = typeof prev
  switch (tp) {
    case 'string':
    case 'number':
    case 'boolean':
    case 'symbol':
    case 'function':
    case 'bigint':
      return next
    default: // Object
      const result: Record<string, any> = {}
      for (const [key, value] of Object.entries(prev)) {
        if (next.hasOwnProperty(key)) {
          result[key] = updateCarefully(value, next[key])
        }
      }
      for (const [key, value] of Object.entries(next)) {
        if (!prev.hasOwnProperty(key)) {
          result[key] = value
        }
      }
      return result
  }
}

export const deepEqual = (a: any, b: any) => {
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
    default:
      break
  }
  // It is an object.
  if (Object.keys(a).length !== Object.keys(b).length) return false;
  for (const [key, value] of Object.entries(a)) {
    if (!b.hasOwnProperty(key)) return false
    if (!deepEqual(value, b[key])) return false
  }
  return true
}
