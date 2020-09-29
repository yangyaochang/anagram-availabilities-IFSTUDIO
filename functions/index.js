const functions = require('firebase-functions');
const axios = require('axios')
const cors = require('cors')
const express = require('express')
const app = express()
const firebase = require('./firebase_admin')

const fireData = firebase.database()

app.use(cors({ origin: true }))

const url = 'https://api.rentcafe.com/rentcafeapi.aspx'
const token = 'MTAyNjAx-G%2b9Xn95HlTo%3d' 
const propertyCode = 'p1165275'
/*
ApartmentAvailability Request Type: Returns apartment data.
`${url}?requestType=apartmentavailability&floorplanId=${id}&apiToken=${token}&propertyCode=${propertyCode}`

FloorPlan Request Type: Returns floor plan data.
`${url}?requestType=floorplan&apiToken=${token}&propertyCode=${propertyCode}`

Request FloorPlan and filter out AvailableUnitsCount === '0'
Use FloorplanId to request ApartmentAvailability
Append FloorPlanImageURL from FloorPlan request to corresponding available properties
*/

let FloorplanImageURL = {}

app.get('/', (req, res) => {
    fireData.ref('/').once('value', (snapshot) => {
        res.send(snapshot.val())
    })
})

app.post('/', (req, res) => {
    const d = new Date()

    return axios.get(`${url}?requestType=floorplan&apiToken=${token}&propertyCode=${propertyCode}`).catch((error) => {
        // handle error
        console.log(error);
    })
    .then(response => {
        let availableUnitsByFloorplanId = response.data.filter(property => property.AvailableUnitsCount !== '0')
        // 'data' is the response that was provided by the server

        availableUnitsByFloorplanId.forEach(p => {
            FloorplanImageURL[p.FloorplanId] = p.FloorplanImageURL
        })
        return availableUnitsByFloorplanId
    })
    .then((availableUnitsByFloorplanId) => {
        return Promise.all(availableUnitsByFloorplanId.map(property => {
            return axios.get(`${url}?requestType=apartmentavailability&floorplanId=${property.FloorplanId}&apiToken=${token}&propertyCode=${propertyCode}`)
        }))
        .catch(error => {
            console.error(error)
        })
        .then(response => {
            const raw = response.map(res => res.data)
            // raw is an array of arrays which contains one or more objects, so raw needs to be flattened
            const availabilities = []

            raw.forEach(r => {
                r.forEach(a => {availabilities.push(a)})
            })

            availabilities.forEach(a => {
                a['FloorplanImageURL'] = FloorplanImageURL[a.FloorplanId]
                a.UnitImageURLs = a.UnitImageURLs[0].split(',')
            })
            
            console.log('Updated data at:' + d)
            console.log('timeStamp:' + d.getTime())
            return availabilities
        })
        .then(data => {
            fireData.ref('/updatedTime').push(d.getTime())
            fireData.ref('/availabilities').set(data)

            return data
        })
    })
})

exports.app = functions.https.onRequest(app);
