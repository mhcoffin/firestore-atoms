import {Provider, useAtom} from 'jotai';
import React, {Suspense, useEffect, useState} from 'react';
import {auth, db} from './fs'
import './App.css';
import firebase from "firebase/app";
import 'firebase/firestore'
import {useAtomValue, useUpdateAtom} from "jotai/utils.cjs";
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
const nameAtom = focusAtom(userInfoAtom, o => o.prop('Name'))

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
        <Payload/>
        <FirstName/>
        <LastName/>
        <FullName/>
        <Age/>
        <Ager/>
      </div>
  )
}

const Payload = () => {
  const json = useAtomValue(userInfoAtom)
  return (
      <Suspense fallback={<div>loading</div>}>
        <div>
          {JSON.stringify(json)}
        </div>
      </Suspense>
  )
}

const FirstName = () => {
  const firstName = useAtomValue(firstNameAtom)
  return (
      <Suspense fallback={<div>Loading first name</div>}>
        <div>
          First name: {firstName}
        </div>
      </Suspense>
  )
}

const LastName = () => {
  const lastName = useAtomValue(lastNameAtom)
  return (
      <Suspense fallback={<div>Loading first name</div>}>
        <div>
          Last name: {lastName}
        </div>
      </Suspense>
  )
}

const FullName = () => {
  const name = useAtomValue(nameAtom)
  return (
      <Suspense fallback={<div>loading</div>}>
        <div>
          {`${name.First} ${name.Last}`}
        </div>
      </Suspense>
  )
}

const Age = () => {
  const [age, setAge] = useAtom(ageAtom)
  return (
      <Suspense fallback={<div>Loading</div>}>
        <div>
          <button onClick={() => setAge(age + 1)}>{age}</button>
        </div>
      </Suspense>
  )
}

const Ager = () => {
  const setAge = useUpdateAtom(ageAtom)
  return (
      <Suspense fallback={<div>loading</div>}>
        <div>
          <button onClick={() => setAge(age => age + 1)}>+1</button>
        </div>
      </Suspense>
  )
}

export default App;
