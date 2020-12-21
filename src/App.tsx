import { Provider } from 'jotai';
import React, {useEffect, useState} from 'react';
import {auth, db} from './fs'
import './App.css';
import firebase from "firebase";

type User = firebase.User;

function App() {
  return (
      <Provider>
        <div className="App">
          <Experiment/>
        </div>
      </Provider>
  );
}

const Experiment = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  useEffect(() => {
    auth.onAuthStateChanged(user => {
      setCurrentUser(user)
    })
  })
  return <div>{currentUser?.uid}</div>
}

export default App;
