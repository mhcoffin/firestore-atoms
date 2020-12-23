import {PrimitiveAtom, Provider, useAtom} from 'jotai';
import React, {Suspense, useEffect, useState} from 'react';
import {auth, db} from './fs'
import './App.css';
import firebase from "firebase/app";
import {useAtomValue} from "jotai/utils.cjs";
import {firestoreAtom, useFirestoreSubscriber} from "./firestoreAtom";

type Timestamp = firebase.firestore.Timestamp;

type User = firebase.User;
const uid = 'VRf7soDS0BQ6praLnktgJfD5CVa2'

type PageType = {
  Name: {
    First: string
    Last: string
  }
  CreateTime: Timestamp,
}

function isPageType(x: any): x is PageType {
  return x.hasOwnProperty('Name')
      && x.Name.hasOwnProperty('First') && typeof x.Name.First === 'string'
      && x.Name.hasOwnProperty('Last') && typeof x.Name.Last === 'string'
}

// userInfoAtom will be suspended until the page is read.
// userInfoUpdater is a function that can be used to subscribe
// to the specified collection
const [userInfoAtom, userInfoUpdater] =
    firestoreAtom<PageType>(db.collection('Users').doc(uid), isPageType)

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
  const handleClick = () => setValue({
    Name: {
      First: value.Name.First,
      Last: "f" + value.Name.Last,
    },
    CreateTime: new firebase.firestore.Timestamp(0, 0)
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
  useFirestoreSubscriber(userInfoUpdater)
  if (fallback) {
    return (<Suspense fallback={fallback}>
          {children}
        </Suspense>
    )
  } else {
    return <>
      {children}
    </>
  }
}

export default App;
