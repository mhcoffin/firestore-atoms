import firebase from 'firebase/app'
import 'firebase/firestore'
import 'firebase/auth'


// Your web app's Firebase configuration
var firebaseConfig = {
  apiKey: "AIzaSyCHrbsyHCpDtoKrOg6FuPJDTfV2eI8yeTE",
  authDomain: "fugalist.firebaseapp.com",
  databaseURL: "https://fugalist.firebaseio.com",
  projectId: "fugalist",
  storageBucket: "fugalist.appspot.com",
  messagingSenderId: "52283527895",
  appId: "1:52283527895:web:f303c2f6365f7f77275692"
};

firebase.initializeApp(firebaseConfig);

export const auth = firebase.auth()
export const db = firebase.firestore()

if (window.location.hostname === 'localhost') {
  db.useEmulator('localhost', 8080)
}

