import {Provider, useAtom} from 'jotai';
import React, {Suspense, useEffect, useState} from 'react';
import {auth, db} from './fs'
import './App.css';
import firebase from "firebase/app";
import 'firebase/firestore'
import {useAtomValue, useUpdateAtom} from "jotai/utils.cjs";
import {docAtom, Subscriber, useDocSubscriber} from "./docAtom";
import {focusAtom} from 'jotai/optics'

type User = firebase.User;
const uid = 'VRf7soDS0BQ6praLnktgJfD5CVa2'

type UserInfo = {
  CreateTime: firebase.firestore.Timestamp
  ModifyTime: firebase.firestore.Timestamp
  Name: {
    First: string
    Last: string
  }
  Age: number
}

function isPageType(x: any): x is UserInfo {
  return x.hasOwnProperty('Name')
      && x.Name.hasOwnProperty('First') && typeof x.Name.First === 'string'
      && x.Name.hasOwnProperty('Last') && typeof x.Name.Last === 'string'
      && x.hasOwnProperty('Age') && typeof x.Age === 'number'
}

const [userInfoAtom, userSubscriber] =
    docAtom<UserInfo>(db.collection('Users').doc(uid), {typeGuard: isPageType})

const firstNameAtom = focusAtom(userInfoAtom, o => o.prop('Name').prop('First'))
const lastNameAtom = focusAtom(userInfoAtom, o => o.prop('Name').prop('Last'))
const ageAtom = focusAtom(userInfoAtom, o => o.prop('Age'))

function App() {
  return (
      <Provider>
        <Suspense fallback={<div>Outer suspense...</div>}>
          <div className="App">
            <Auth/>
            <SubscribeToPage subscriber={userSubscriber}/>
            <FirstName/>
            <LastName/>
            <Age/>
          </div>
        </Suspense>
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

const FirstName = () => {
  const firstName = useAtomValue(firstNameAtom)
  return (
      <Suspense fallback={<div>Loading first name</div>}>
        First name: {firstName}
      </Suspense>
  )
}

const LastName = () => {
  const lastName = useAtomValue(lastNameAtom)
  return (
      <Suspense fallback={<div>Loading first name</div>}>
        Last name: {lastName}
      </Suspense>
  )
}

const Age = () => {
  const [age, setAge] = useAtom(ageAtom)
  return (
      <Suspense fallback={<div>Loading</div>}>
        <button onClick={() => setAge(age => age + 1)}>{age}</button>
      </Suspense>
  )
}

type SubscriberType = {
  subscriber: Subscriber
}

const SubscribeToPage = ({subscriber}: SubscriberType) => {
  useDocSubscriber(subscriber)
  return null
}

export default App;
