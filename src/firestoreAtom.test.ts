import {deepEqual, updateCarefully} from './firestoreAtom'
import firebase from 'firebase/app'
import 'firebase/firestore'

describe('deep equal', () => {
  it('numbers', () => {
    expect(deepEqual(1, 1)).toBeTruthy()
    expect(deepEqual(1, 3)).toBeFalsy()
  })
  it('strings', () => {
    expect(deepEqual('abc', 'abc')).toBeTruthy()
    expect(deepEqual('abc', 'abd')).toBeFalsy()
  })
  it('booleans', () => {
    expect(deepEqual(true, true)).toBeTruthy()
    expect(deepEqual(false, false)).toBeTruthy()
    expect(deepEqual(false, true)).toBeFalsy()
  })
  it('timestamps', () => {
    const t1 = firebase.firestore.Timestamp.now()
    expect(deepEqual(t1, t1)).toBeTruthy()
    const t2 = new firebase.firestore.Timestamp(t1.seconds, t1.nanoseconds)
    expect(deepEqual(t1, t2)).toBeTruthy()
  })
  it('objects', () => {
    expect(deepEqual({a: 3, b: 4}, {b: 4, a: 3})).toBeTruthy()
    expect(deepEqual({a: 3, b: 4}, {b: 4, a: 3, c: 5})).toBeFalsy()
    expect(deepEqual({a: 3, b: 4, c: {d: 1, e: 2}}, {b: 4, a: 3, c: 5})).toBeFalsy()
    expect(deepEqual({a: 3, b: 4, c: {d: 1, e: 2}}, {b: 4, a: 3, c: {d: 1, e: 2}})).toBeTruthy()
  })
  it('deep objects', () => {
    const a = {
      key1: 'value1',
      key2: {
        keyA: {
          keyB: {
            keyC: {
              keyD: false,
              keyE: 23,
            }
          },
          keyC: {
            keyF: 17,
            keyG: 'eight'
          }
        }
      }
    }

    expect(deepEqual(a, a)).toBeTruthy()
    expect(deepEqual(a, {...a})).toBeTruthy()

    const b = JSON.parse(JSON.stringify(a))
    b.key2.keyA.keyC.keyF = 24
    expect(deepEqual(a, b)).toBeFalsy()
  })
  it('arrays', () => {
    const a = [1, 2, 3, {a: 12, b: 13}]
    expect(deepEqual(a, a)).toBeTruthy()
    expect(deepEqual(a, [...a])).toBeTruthy()
    expect(deepEqual(a, [1, 2, 3, {a: 12, b: 13}])).toBeTruthy()
    expect(deepEqual(a, [1, 2, 3, {a: 12, c: 13}])).toBeFalsy()

  })
})

describe('update', () => {
  it('flat', () => {
    const a = {
      k1: 13,
      k2: false,
      k3: 'name'
    }
    const b = JSON.parse(JSON.stringify(a))
    expect(updateCarefully(a, b)).toBe(a)
  })
  it('deep but eq', () => {
    const a = {
      k1: {
        k2: {
          k3: {
            k4: 'foo',
            k5: 'bar',
          }
        },
        k6: {
          k7: 'xyzzy',
          k8: 23,
        }
      }
    }
    const b = JSON.parse(JSON.stringify(a))
    expect(updateCarefully(a, b)).toBe(a)
  })
  it('shared structure', () => {
    const a = {
      k1: {
        k2: {
          k3: {
            k4: 'foo',
            k5: 'bar',
          }
        },
        k6: {
          k7: 'xyzzy',
          k8: 23,
        }
      }
    }
    const b = {
      k1: {
        k2: {
          k3: {
            k4: 'foo-diff',
            k5: 'bar',
          }
        },
        k6: {
          k7: 'xyzzy',
          k8: 23,
        }
      }
    }
    const c = updateCarefully(a, b)
    expect(deepEqual(c, b)).toBeTruthy()
    expect(a.k1.k2.k3).not.toBe(c.k1.k2.k3)
    expect(a.k1.k6).toBe(c.k1.k6)
  })
})