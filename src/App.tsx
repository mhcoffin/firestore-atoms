import {Provider, useAtom} from 'jotai';
import React, {Suspense, useEffect, useState} from 'react';
import {auth, db} from './fs'
import './App.css';
import firebase from "firebase/app";
import 'firebase/firestore'
import {useAtomValue} from "jotai/utils.cjs";
import {CREATE_TS, docAtom, MODIFY_TS, useDocSubscriber} from "./docAtom";
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

const fallback = {
  CreateTime: CREATE_TS,
  ModifyTime: MODIFY_TS,
  Name: {
    First: "Mike",
    Last: "Coffin"
  },
  Age: 23
}

function isPageType(x: any): x is UserInfo {
  return x.hasOwnProperty('Name')
      && x.Name.hasOwnProperty('First') && typeof x.Name.First === 'string'
      && x.Name.hasOwnProperty('Last') && typeof x.Name.Last === 'string'
      && x.hasOwnProperty('Age') && typeof x.Age === 'number'
}

const [userInfoAtom, userInfoSubscriber] = docAtom<UserInfo>(
    {typeGuard: isPageType, fallback: fallback})

const firstNameAtom = focusAtom(userInfoAtom, o => o.prop('Name').prop('First'))
const lastNameAtom = focusAtom(userInfoAtom, o => o.prop('Name').prop('Last'))
const ageAtom = focusAtom(userInfoAtom, o => o.prop('Age'))

function App() {
  return (
      <Provider>
        <Suspense fallback={<div>Outer suspense...</div>}>
          <UserPage uid={uid}/>
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

const UserPage = ({uid}: { uid: string }) => {
  useDocSubscriber(userInfoSubscriber(db.collection('Users').doc(uid)))
  return (
      <div>
        <Auth/>
        <FirstName/>
        <LastName/>
        <Age/>
      </div>
  )
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

export default App;
