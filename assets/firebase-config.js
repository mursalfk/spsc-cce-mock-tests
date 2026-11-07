/* assets/firebase-config.js : the ONLY file you edit to switch login + email on.
   Fill the two blocks below (see instructions.md, steps 1 and 2). None of these values is a secret. */
window.SPSC_CONFIG = {
  // Firebase console > Project settings > Your apps > Web app > SDK setup and configuration > Config
  firebase: {
    apiKey: "AIzaSyAqfQNx9jC8qJ2dG0nUbcj2JDkmhBTie8U",
    authDomain: "spsc-cce-mock-tests.firebaseapp.com",
    projectId: "spsc-cce-mock-tests",
    appId: "1:184558946020:web:2aa34a9d483fc52af8cef1"
  },
  // Apps Script > Deploy > Manage deployments > Web app URL (ends with /exec)
  mailEndpoint: "https://script.google.com/macros/s/AKfycbxXxINj6XfKUI9PrShjQ_F44-GAiLH8zUp303eResuOCndfIj4nXIxVMz6MlM5CXFHHVw/exec",
  passMark: 66
};


// // Import the functions you need from the SDKs you need
// // import { initializeApp } from "firebase/app";
// // import { getAnalytics } from "firebase/analytics";
// // TODO: Add SDKs for Firebase products that you want to use
// // https://firebase.google.com/docs/web/setup#available-libraries

// // Your web app's Firebase configuration
// // For Firebase JS SDK v7.20.0 and later, measurementId is optional
// // const firebaseConfig = {
// //   apiKey: "AIzaSyAqfQNx9jC8qJ2dG0nUbcj2JDkmhBTie8U",
// //   authDomain: "spsc-cce-mock-tests.firebaseapp.com",
// //   projectId: "spsc-cce-mock-tests",
// //   storageBucket: "spsc-cce-mock-tests.firebasestorage.app",
// //   messagingSenderId: "184558946020",
// //   appId: "1:184558946020:web:2aa34a9d483fc52af8cef1",
// //   measurementId: "G-XXECY19CRJ"
// // };

// // Initialize Firebase
// // const app = initializeApp(firebaseConfig);
// // const analytics = getAnalytics(app);