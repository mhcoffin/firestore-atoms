import {atom, PrimitiveAtom} from 'jotai'
import {SetStateAction} from 'jotai/core/types'

type Slice<V, S> = {
  select: (v: V) => S,
  inject: (v: V, s: S) => V
}

export const sliceAtom = <T, S>(anAtom: PrimitiveAtom<T>, slice: Slice<T, S>) => {
  return atom(
    (get) => slice.select(get(anAtom)),
    (get, set, update: SetStateAction<S>) => {
      const newSliceValue = update instanceof Function ? update(slice.select(get(anAtom))) : update
      set(anAtom, slice.inject(get(anAtom), newSliceValue))
    }
  )
}

export const fieldAtom = <V, K extends keyof V>(anAtom: PrimitiveAtom<V>, field: K) => {
  return sliceAtom<V, V[K]>(anAtom, {
    select: (v: V) => v[field],
    inject: (v: V, s: V[K]) => ({...v, [field]: s})
  })
}