import {Provider, useAtom} from 'jotai';
import React, {Suspense, useEffect, useState} from 'react';
import {auth, db} from './fs'
import './App.css';
import firebase from "firebase/app";
import {useAtomValue} from "jotai/utils.cjs";
import {firestoreAtom, Subscriber, useFirestoreSubscriber} from "./firestoreAtom";

type User = firebase.User;
const uid = 'VRf7soDS0BQ6praLnktgJfD5CVa2'

type PageType = {
  Name: {
    First: string
    Last: string
  }
}

function isPageType(x: any): x is PageType {
  return x.hasOwnProperty('Name')
      && x.Name.hasOwnProperty('First') && typeof x.Name.First === 'string'
      && x.Name.hasOwnProperty('Last') && typeof x.Name.Last === 'string'
}

// userInfoAtom will be suspended until the page is read.
// userInfoUpdater is a function that can be used to subscribe
// to the specified collection
const [userInfoAtom, userSubscriber] =
    firestoreAtom<PageType>(db.collection('Users').doc(uid), {typeGuard: isPageType})

const [xInfoAtom, xInfoSubscriber] =
    firestoreAtom<PageType>(db.collection('Users').doc('foo'),
        {fallback: {Name: {First: 'Fred', Last: 'Flintstome'}}}
    )

function App() {
  return (
      <Provider>
        <div className="App">
          <Auth/>
          <SubscribeToPage
              subscriber={userSubscriber}
              fallback={<div>Loading...</div>}
          >
            <Reader/>
            <AnotherReader/>
          </SubscribeToPage>
          <SubscribeToPage
              subscriber={xInfoSubscriber}
              fallback={<div>Loading fred</div>}
          >
            <Fred/>
          </SubscribeToPage>
        </div>
      </Provider>
  );
}

const Fred = () => {
  const info = useAtomValue(xInfoAtom)
  return <div>{JSON.stringify(info)}</div>
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
  })
  return (
      <>
        <div>{value.Name.First}</div>
        <button onClick={handleClick}>+</button>
      </>
  )
}

type SubscriberType = {
  subscriber: Subscriber
  children: React.ReactNode
  fallback?: React.ReactElement
}

const SubscribeToPage = ({subscriber, children, fallback}: SubscriberType) => {
  useFirestoreSubscriber(subscriber)
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
