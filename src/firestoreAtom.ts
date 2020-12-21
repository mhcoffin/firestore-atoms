import {atom, PrimitiveAtom} from "jotai";
import firebase from 'firebase/app'
import {suspenseAtom} from "./suspenseAtom";
import {Getter, SetStateAction, Setter} from "jotai/core/types";

export const firestoreAtom = <T>(doc: firebase.firestore.DocumentReference):
    [PrimitiveAtom<T>, (get: Getter, set: Setter) => () => void] => {
  const store = suspenseAtom<T>()

  const at = atom(
      (get) => get(store),
      (get, set, update: SetStateAction<T>) => {
        // TODO write to firebase
        set(store, update)
      }
  )

  const subscriber = (get: Getter, set: Setter) => {
    console.log(`subscriber`)
    const unsubscribe = doc.onSnapshot(snap => {
      // TODO: do minimal update of store instead of slamming it
      set(store, snap.data() as T)
    })
    return () => {
      // TODO reset atom?
      unsubscribe()
    }
  }

  return [at, subscriber]
}