import {atom, WritableAtom} from 'jotai'
import {SetStateAction} from 'jotai/core/types'

// A suspenseAtom begins life suspended (as an unresolved Promise) and remains suspended
// until it is set. After it has been set, it acts like a regular writable atom.
//
// The init parameter is *only* used if the first set uses a setter function. If you are
// sure that you won't initialize with a setter function, you don't need to supply init.
export const suspenseAtom = <T>(init?: T): WritableAtom<T, SetStateAction<T>> => {
  type Resolve = (v: T | PromiseLike<T>) => void
  const pending = Symbol()
  const store = atom<T | typeof pending>(pending)
  const waitingReaders: Resolve[] = []

  return atom(
      async (get): Promise<T> => {
        const value = get(store)
        if (value === pending) {
          return new Promise((resolve) => waitingReaders.push(resolve))
        } else {
          return value
        }
      },
      (get, set, update) => {
        const current = get(store)
        if (current === pending) {
          if (update instanceof Function) {
            if (!init) {
              throw new Error('first set of a suspenseAtom cannot be an update if "init" is not provided')
            }
            set(store, update(init))
          } else {
            set(store, update)
          }
          const val = get(store)
          while (waitingReaders.length > 0) {
            const reader = waitingReaders.shift()
            if (reader !== undefined) reader(val as T)
          }
        } else {
          if (update instanceof Function) {
            set(store, update(current))
          } else {
            set(store, update)
          }
        }
      }
  )
}
