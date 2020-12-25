import {CREATE_TS, MODIFY_TS, testable} from './firestoreAtom'
import firebase from 'firebase/app'
import 'firebase/firestore'

const {deq, updateConservatively, firestoreDiff} = testable

describe('deep equal', () => {
  it('numbers', () => {
    expect(deq(1, 1)).toBeTruthy()
    expect(deq(1, 3)).toBeFalsy()
  })
  it('strings', () => {
    expect(deq('abc', 'abc')).toBeTruthy()
    expect(deq('abc', 'abd')).toBeFalsy()
  })
  it('booleans', () => {
    expect(deq(true, true)).toBeTruthy()
    expect(deq(false, false)).toBeTruthy()
    expect(deq(false, true)).toBeFalsy()
  })
  it('timestamps', () => {
    const t1 = firebase.firestore.Timestamp.now()
    expect(deq(t1, t1)).toBeTruthy()
    const t2 = new firebase.firestore.Timestamp(t1.seconds, t1.nanoseconds)
    expect(deq(t1, t2)).toBeTruthy()
  })
  it('objects', () => {
    expect(deq({a: 3, b: 4}, {b: 4, a: 3})).toBeTruthy()
    expect(deq({a: 3, b: 4}, {b: 4, a: 3, c: 5})).toBeFalsy()
    expect(deq({a: 3, b: 4, c: {d: 1, e: 2}}, {b: 4, a: 3, c: 5})).toBeFalsy()
    expect(deq({a: 3, b: 4, c: {d: 1, e: 2}}, {b: 4, a: 3, c: {d: 1, e: 2}})).toBeTruthy()
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

    expect(deq(a, a)).toBeTruthy()
    expect(deq(a, {...a})).toBeTruthy()

    const b = JSON.parse(JSON.stringify(a))
    b.key2.keyA.keyC.keyF = 24
    expect(deq(a, b)).toBeFalsy()
  })
  it('arrays', () => {
    const a = [1, 2, 3, {a: 12, b: 13}]
    expect(deq(a, a)).toBeTruthy()
    expect(deq(a, [...a])).toBeTruthy()
    expect(deq(a, [1, 2, 3, {a: 12, b: 13}])).toBeTruthy()
    expect(deq(a, [1, 2, 3, {a: 12, c: 13}])).toBeFalsy()
    expect(deq(a, [1, 2, 3, {a: 12, c: null}])).toBeFalsy()
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
    expect(updateConservatively(a, b)).toBe(a)
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
    expect(updateConservatively(a, b)).toBe(a)
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
    const c = updateConservatively(a, b)
    expect(deq(c, b)).toBeTruthy()
    expect(a.k1.k2.k3).not.toBe(c.k1.k2.k3)
    expect(a.k1.k6).toBe(c.k1.k6)
  })
})

describe('diff', () => {
  const DELETE = firebase.firestore.FieldValue.delete()
  it('int', () => {
    const a = {
      b: 1,
      c: 2,
      d: 3,
      e: 4,
    }
    const b = {
      b: 1,
      c: 3,
      d: undefined,
      f: 5,
    }
    const diff = firestoreDiff(a, b)
    expect(diff).toEqual({c: 3, d: DELETE, e: DELETE, f: 5})
  })
  it('string', () => {
    const a = {
      b: '1',
      c: '2',
      d: '3',
      e: '4',
    }
    const b = {
      b: '1',
      c: '3',
      d: undefined,
      f: '5',
    }
    const diff = firestoreDiff(a, b)
    expect(diff).toEqual({c: '3', d: DELETE, e: DELETE, f: '5'})
  })
  it('boolean', () => {
    const a = {
      b: true,
      c: false,
      d: true,
      e: false,
    }
    const b = {
      b: true,
      c: true,
      d: undefined,
      f: true,
    }
    const diff = firestoreDiff(a, b)
    expect(diff).toEqual({c: true, d: DELETE, e: DELETE, f: true})
  })
  it('nested changes', () => {
    const a = {
      A: {
        a: 1,
        b: 2,
        c: {
          d: 3,
          e: 4,
          f: {
            g: 5,
            h: 6,
          }
        },
        d: {
          i: 7,
          j: 8,
          k: 9
        },
        e: {
          f: 13,
        }
      }
    }
    const b = {
      A: {
        a: 1,
        b: 2,
        c: {
          d: 17,
          e: 4,
          f: {
            g: 5,
            h: 19,
          }
        },
        d: {
          i: 7,
          j: 81,
        }
      }
    }
    const diff = firestoreDiff(a, b)
    expect(diff).toEqual({
      'A.c.d': 17,
      'A.c.f.h': 19,
      'A.d.j': 81,
      'A.d.k': DELETE,
      'A.e': DELETE,
    })
  })
  it('explicit delete', () => {
    const a = {
      A: 'foo',
      B: {
        C: 'bar',
        D: 'zoo'
      }
    }
    const b = {...a, B: {...a.B, D: undefined}}
    expect(firestoreDiff(a, b)).toEqual({
      'B.D': DELETE
    })
  })
  it('implicit delete', () => {
    const a = {
      A: 'foo',
      B: {
        C: 'bar',
        D: 'zoo'
      }
    }
    const b = {
      A: 'foo',
      B: {
        C: 'bar',
      }
    }
    expect(firestoreDiff(a, b)).toEqual({
      'B.D': DELETE,
    })
  })
  it('create does not override normal timestamps', () => {
    const a = {
      C: firebase.firestore.Timestamp.now()
    }
    const b = {
      C: CREATE_TS
    }
    expect(firestoreDiff(a, b)).toEqual({})
  })
  it('modify overrides other timestamps', () => {
    const a = {
      T: firebase.firestore.Timestamp.now()
    }
    const b = {
      T: MODIFY_TS
    }
    expect(firestoreDiff(a, b)).toEqual({
      T: firebase.firestore.FieldValue.serverTimestamp()
    })
  })
  it('normal timestamps override', () => {
    const t = new firebase.firestore.Timestamp(7, 7)
    const a = {
      T: firebase.firestore.Timestamp.now()
    }
    const b = {
      T: t
    }
    expect(firestoreDiff(a, b)).toEqual({
      T: t
    })
  })
  it('timestamp can be deleted', () => {
    const a = {
      T: firebase.firestore.Timestamp.now(),
      U: 'foobar'
    }
    const b = {
      U: 'foobar'
    }
    expect(firestoreDiff(a, b)).toEqual({
      T: firebase.firestore.FieldValue.delete()
    })
  })
})
