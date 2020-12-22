import {PrimitiveAtom, Provider, useAtom} from 'jotai';
import React, {Suspense, useEffect, useState} from 'react';
import {auth, db} from './fs'
import './App.css';
import firebase from "firebase";
import {useAtomCallback, useAtomValue} from "jotai/utils.cjs";
import {firestoreAtom} from "./firestoreAtom";

type User = firebase.User;
const uid = 'VRf7soDS0BQ6praLnktgJfD5CVa2'

type PageType = {
  Name: {
    First: string
    Last: string
  }
}

// userInfoAtom will be suspended until the page is read.
// userInfoUpdater is a function that can be used to subscribe
// to the specified collection
const [userInfoAtom, userInfoUpdater] =
    firestoreAtom<PageType>(db.collection('Users').doc(uid))

function App() {
  return (
      <Provider>
        <div className="App">
          <Auth/>
          <SubscribeToPage
              atom={userInfoAtom}
              path={db.collection('Users').doc(uid)}
              fallback={<div>Loading...</div>}
          >
            <Reader/>
            <AnotherReader/>
          </SubscribeToPage>
        </div>
      </Provider>
  );
}

const Auth = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  useEffect(() => {
    auth.onAuthStateChanged(user => setCurrentUser(user))
  })
  return <div>Current user: {currentUser?.uid}</div>
}

const Reader = () => {
  const value = useAtomValue(userInfoAtom)
  return <div>json: {JSON.stringify(value)}</div>
}

const AnotherReader = () => {
  const [value, setValue] = useAtom(userInfoAtom)

  const ts = firebase.firestore.Timestamp.now()
  console.log(`enumberable properties: ${Object.keys(ts)}`)

  const handleClick = () => setValue({
    Name: {
      First: value.Name.First,
      Last: "f" + value.Name.Last,
    }
  })
  return (
      <>
        <div>{value.Name.First}</div>
        <button onClick={handleClick}>+</button>
      </>
  )
}

type SubscriberType<T> = {
  atom: PrimitiveAtom<T>
  path: firebase.firestore.DocumentReference
  children: React.ReactNode
  fallback?: React.ReactElement
}

const SubscribeToPage = <T extends Object>({atom, path, children, fallback}: SubscriberType<T>) => {
  const subscriber = useAtomCallback(userInfoUpdater)
  useEffect(() => {
    (async () => await subscriber())()
  }, [subscriber])

  if (fallback) {
    return (<Suspense fallback={fallback}>
          {children}
        </Suspense>
    )
  } else {
    return <>{children}</>
  }
}

export default App;
