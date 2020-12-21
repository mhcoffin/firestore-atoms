import { atom, WritableAtom } from 'jotai'
import { SetStateAction } from 'jotai/core/types'

// A suspenseAtom has no initial value. Instead, it begins life
// suspended and remains suspended until it is set. After it has
// been set, it acts like a regular writable atom.
export const suspenseAtom = <T>(): WritableAtom<T, SetStateAction<T>> => {
  type Resolve = (v: T | PromiseLike<T>) => void
  const pending = Symbol()
  const store = atom<T | typeof pending>(pending)
  const waitingReaders: Resolve[] = []

  const result: WritableAtom<T, SetStateAction<T>> = atom(
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
            throw new Error('first set of a suspenseAtom cannot be an update')
          } else {
            set(store, update)
          }
          while (waitingReaders.length > 0) {
            const reader = waitingReaders.shift()
            if (reader !== undefined) reader(update)
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
  return result
}
