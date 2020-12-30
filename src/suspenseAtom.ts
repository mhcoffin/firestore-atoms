import {atom, WritableAtom} from 'jotai'
import {SetStateAction} from 'jotai/core/types'

/**
 * A suspense atom begins its life suspended and remains that way until it is set (in
 * useEffect, presumably). After it has been set, it functions as an ordinary writable
 * atom.
 *
 * @param init Used only if the first call to 'set' uses a setter function rather than
 * a value.
 */
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
        console.log(`setting suspenseAtom`)
        const current = get(store)
        if (current === pending) {
          if (update instanceof Function) {
            if (init === undefined) {
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
