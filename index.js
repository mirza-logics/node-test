const express = require('express')
const app = express()
const httpServer = require('http').createServer(app)
// const { ExpressPeerServer } = require("peer")
const bodyParser = require('body-parser');
const {Server} = require('socket.io')
const cors = require('cors')
const io = new Server(httpServer, {cors: {origin: "*"}})
// const peerServer = ExpressPeerServer(httpServer)

const _ = require('lodash')

const mongoose = require("mongoose")
const User = require('./api/Models/User')

app.use(cors({origin: '*'}))
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({extended: true}))
// app.use("/peerjs", peerServer)
//
// peerServer.on('connection', client => {
//     console.log(client)
// })
//
// peerServer.on('disconnect', client => {
//     console.log(client)
// })

const {v4: uuidV4} = require('uuid')
const models = {}

// mongoose.connect('mongodb://127.0.0.1:27017/stream');
mongoose.connect('mongodb+srv://maliworks:Yourgroup1@cluster0.jt1le6n.mongodb.net/?retryWrites=true&w=majority')

app.post('/login', async (req, res) => {
    const {user_name, password} = req.body
    const user = await User.findOne({email: user_name, password})

    if (user) {
        res.status(200).json(user)
    } else {
        res.status(203).json({err: 'Invalid user!'})
    }
})

app.post('/signup', async (req, res) => {
    const {name, user_name, password} = req.body
    let user = await User.findOne({email: user_name})

    if (user) {
        res.status(203).json({err: 'Email already exists!'})
    } else {
        user = new User({name: name, email: user_name, password: password, uuid: uuidV4()})
        await user.save()
        res.status(201).json(user)
    }
})

io.on('connection', socket => {

    io.emit('live:models', Object.values(models))

    socket.on('go:live', req => {
        models[socket.id] = {...req, socket_id: socket.id}
        socket.join(req.peer_id)

        io.emit('live:models', Object.values(models))
    })

    socket.on('send:req', ({peer_id, socket_id, my_peer_id}) => {
        socket.join(peer_id)
        io.to(socket_id).emit('join:req', my_peer_id)
    })

    socket.on('send:share:alert', screen_peer_id => {
        socket.to(models[socket.id].peer_id).emit('rec:share:alert', socket.id)
    })

    socket.on('ping:share:req', ({model_socket_id, my_screen_peer_id}) => {

        io.to(model_socket_id).emit('get:share:req', my_screen_peer_id)
    })

    socket.on('end:share:screen', room_id => {
        socket.to(room_id).emit('end:screen', 'by')
    })

    // chat related

    socket.on('send:msg', res => {
        io.to(res.room).emit('rec:msg', {
            name: res.name,
            msg: res.msg
        })
    })

    socket.on("disconnecting", () => {
        socket.rooms.forEach(room => {
            if (socket.id !== room) {
                socket.to(room).emit("end:stream");
            }
        })
    });

    socket.on("disconnect", (reason) => {

        delete models[socket.id]
        // console.log(`disconnect ${socket.id} due to ${reason}`)
        io.emit('live:models', Object.values(models))
    })
})


const PORT = process.env.PORT || 5000
httpServer.listen(PORT, () => console.log(`api running on port: ${PORT}`))