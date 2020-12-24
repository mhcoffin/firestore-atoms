import {Provider, useAtom} from 'jotai';
import React, {Suspense, useEffect, useState} from 'react';
import {auth, db} from './fs'
import './App.css';
import firebase from "firebase/app";
import {useAtomValue, useUpdateAtom} from "jotai/utils.cjs";
import {firestoreAtom, Subscriber, useFirestoreSubscriber} from "./firestoreAtom";
import {userInfo} from "os";

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
        <Suspense fallback={<div>Loading...</div>}>
          <div className="App">
            <Auth/>
            <SubscribeToPage subscriber={userSubscriber}/>
            <SubscribeToPage subscriber={xInfoSubscriber}/>
            <Suspense fallback={<div>Reader loading...</div>}>
              <Reader/>
            </Suspense>
            <Suspense fallback={<div>ReaderWriterLoading...</div>}>
              <ReaderWriter/>
            </Suspense>
            <Suspense fallback={<div>PureWriter loading...</div>}>
              <PureWriter/>
            </Suspense>
            <Suspense fallback={<div>Fred loading...</div>}>
              <Fred/>
            </Suspense>
          </div>
        </Suspense>
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

const ReaderWriter = () => {
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

const PureWriter = () => {
  const updateLastName = useUpdateAtom(userInfoAtom)
  const handleClick = () => {
    updateLastName(v => ({Name: {First: v.Name.First, Last: "p" + v.Name.Last}}))
  }
  return <button onClick={handleClick}>Add a p</button>
}

type SubscriberType = {
  subscriber: Subscriber
}

const SubscribeToPage = ({subscriber}: SubscriberType) => {
  useFirestoreSubscriber(subscriber)
  return null
}

export default App;
