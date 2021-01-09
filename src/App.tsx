import {Provider, useAtom} from 'jotai'
import React, {Suspense, useEffect, useState} from 'react'
import {auth, db} from './fs'
import './App.css'
import firebase from "firebase/app"
import 'firebase/firestore'
import {useAtomValue, useSelector, useUpdateAtom} from "jotai/utils.cjs"
import {CREATE_TS, docAtom, MODIFY_TS, useDocSubscriber} from "./docAtom"
import {fieldAtom, sliceAtom} from './sliceAtom'

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

const [userInfoAtom, userInfoSubscriber] = docAtom(
  {typeGuard: isPageType, fallback: fallback})

const ageSliceAtom = sliceAtom(userInfoAtom, {
  select: (v: UserInfo) => v.Age,
  inject: (v: UserInfo, s: number) => ({...v, Age: s})
})

const ageFieldAtom = fieldAtom(userInfoAtom, 'Age')

const firstNameAtom = sliceAtom(userInfoAtom, {
  select: (v: UserInfo) => v.Name.First,
  inject: (v: UserInfo, name: string) => ({...v, Name: {...v.Name, First: name}})
})

const lastNameAtom = sliceAtom(userInfoAtom, {
  select: (v: UserInfo) => v.Name.Last,
  inject: (v: UserInfo, last: string) => ({...v, Name: {...v.Name, Last: last}})
})

function App() {
  return (
    <Provider>
      <Suspense fallback={<div>Outer suspense...</div>}>
        <UserPage uid={uid}/>
      </Suspense>
    </Provider>
  )
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
      <FullName/>
      <Age/>
      <AnotherAge/>
      <ThirdAge/>
      <IncrementAge/>
      <ResetAge/>
    </div>
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
  const name = useSelector(userInfoAtom, info => info.Name)
  return (
    <Suspense fallback={<div>loading</div>}>
      <div>
        {`${name.First} ${name.Last}`}
      </div>
    </Suspense>
  )
}

const Age = () => {
  const age = useAtomValue(ageSliceAtom)
  return (
    <Suspense fallback={<div>loading</div>}>
      <div>Age is {age}</div>
    </Suspense>
  )
}

const AnotherAge = () => {
  const [age, setAge] = useAtom(ageSliceAtom)

  return (
    <Suspense fallback={<div>loading</div>}>
      <div>
        <button onClick={() => setAge(age + 1)}>{age}</button>
      </div>
    </Suspense>
  )
}

const ThirdAge = () => {
  const [age, setAge] = useAtom(ageFieldAtom)
  return (
    <Suspense fallback={<div>loading</div>}>
      <div>
        <button onClick={() => setAge(age + 1)}>Another {age}</button>
      </div>
    </Suspense>
  )

}

const ResetAge = () => {
  const setAge = useUpdateAtom(ageSliceAtom)
  return (
    <Suspense fallback={<div>loading</div>}>
      <div>
        <button onClick={() => setAge(0)}>Reset</button>
      </div>
    </Suspense>
  )
}

const IncrementAge = () => {
  const setAge = useUpdateAtom(ageSliceAtom)
  return (
    <Suspense fallback={<div>loading</div>}>
      <div>
        <button onClick={() => setAge(age => age + 1)}>+1</button>
      </div>
    </Suspense>
  )
}

export default App
