const functions = require("firebase-functions")
const admin = require('firebase-admin')
const { getFirestore, Timestamp, FieldValue } = require('firebase-admin/firestore')
const express = require('express')
const cors = require('cors')({origin: true})
const serviceAccountCredentials = require('./service-credentials.json')

const app = express()
app.use(cors)

admin.initializeApp({ credential: admin.credential.cert(serviceAccountCredentials) })

admin.firestore().settings({ ignoreUndefinedProperties: true })

app.post('/users/create-account', async (req, res) => {
   const { username, age, role, password, email } = req.body

   try {

      // if(role !== 'teacher') {
      //    res.status(500).send({ message: 'Please choose a valid user role.' })
      //    return
      // }

      const uid = getFirestore().collection('users').doc().id
      const profileImage = 'https://picsum.photos/200/300'
      
      await admin.auth().createUser({ uid, displayName: username, age, photoURL: profileImage, password, email })
         .then(() => console.log('success'))
         .catch(() => { throw { message: 'Unable to create new user account. Please try again.' } })

      if(role === 'teacher') {
         const student_uids = []

         await getFirestore().collection('students').get().then(snapshot => {
            if(snapshot.empty) return
            snapshot.forEach(doc => student_uids.push(doc.data().uid))
         }).catch(() => { 
            throw { message: 'Unable to create new user account. Please try again.' } 
         })

         await getFirestore().collection('teachers')
            .doc().create({ 
               uid,
               photoURL: profileImage,
               displayName: username, 
               role,  
               students: student_uids
            }).catch(() => { 
               throw { message: 'An error occurred. Please try again.' } 
            })
      }

      if(role === 'student') {
         await getFirestore().collection('students')
            .doc().create({ 
               uid,
               photoURL: profileImage,
               displayName: username, 
               age,
               role,  
            }).catch(() => { 
               throw { message: 'Unable to create new user account. Please try again.' } 
            })

            await getFirestore().collection('teachers').get().then(snapshot => {
               if(snapshot.empty) return
               snapshot.forEach(async (doc) => {
                  await doc.ref.set({
                     students: FieldValue.arrayUnion(uid)
                  }, { merge: true })
               })
            }).catch(() => { 
               throw { message: 'An error occurred. Please try again.' } 
            })
      }
    
      res.status(200).send({ message: 'Account created successfully!' })
         
   } catch(error) {
      res.status(500).send(error)
   }

});

app.post('/users/createQuestion', async (req, res) => {
   console.log('test')
   const { question, uid } = req.body
   
   try {

      await getFirestore().collection('students')
         .where('uid', '==', uid).get()
         .then(async (snapshot) => {
            const timestamp = Timestamp.now().seconds
            if(snapshot.empty) return

            await snapshot.docs[snapshot.docs.length - 1].ref.set({
               questions: FieldValue.arrayUnion({
                  createdAt: timestamp,
                  question
               })
            }, { merge: true })
            
         })
         .catch(() => {
            throw { message: 'Unable to save your question. Please try again' }
         })

      res.send({ message: 'Questions saved!' })

   } catch(error) {
      res.status(500).send(error)
   }
})

app.get('/users/getStudent', async (req, res) => {
   const { uid } = req.body

   try {
      await getFirestore().collection('students')
         .where('uid', '==', uid).get()
         .then(snapshot => {

            const user = snapshot.docs[snapshot.docs.length - 1].data()
            res.status(200).send(user)
            
         }).catch(() => { throw { message: 'There was an error getting your profile. Please refresh your browser and try again.' }})
   } catch(error) {
      res.status(500).send(error)
   }
})

app.get('/users/getTeacherDashboard', async (req, res) => {
   const { uid } = req.body
   const students = []
   let totalNumberOfQuestions = 0

   try {
      const teacher = await getFirestore().collection('teachers')
         .where('uid', '==', uid).get()
         .then(snapshot => {

            if(snapshot.empty) return

            console.log(snapshot.docs[snapshot.docs.length - 1].data())
            return snapshot.docs[snapshot.docs.length - 1].data()
      
         }).catch(() => {
            throw { message: 'Unable to save your question. Please try again' }
         })

      await getFirestore().collection('students')
         .get().then(snapshot => {
            snapshot.forEach(doc => {
               if(doc.data().questions !== undefined) students.push(doc.data())
            })
         }).catch(() => {
            throw { message: 'Unable to save your question. Please try again' }
         })

      await getFirestore().collection('students')
         .get().then(snapshot => {
            snapshot.forEach(doc => {
               if(doc.data().questions !== undefined) {
                  totalNumberOfQuestions = totalNumberOfQuestions + doc.data().questions.length
               }
            })
         })

      res.send({ ...teacher, students, totalNumberOfQuestions })

   } catch(error) {
      res.status(500).send(error)
   }
})

exports.api = functions.https.onRequest(app);