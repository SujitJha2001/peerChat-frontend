let localStream;
let remoteStream;
let peerConnection;
let localSocketId = null;
let remoteSocketId = null;
let roomId = null;
const socket = io("https://peerchat-kzq3.onrender.com");
const servers = {
    iceServers: [
        {
            urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302']
        }
    ]
}
let init = async () => {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
    document.getElementById('user-1').srcObject = localStream;
}
let createPeerConnection = async (MemberId) => {
    peerConnection = new RTCPeerConnection(servers);

    remoteStream = new MediaStream();
    document.getElementById('user-2').srcObject = remoteStream;
    document.getElementById('user-2').style.display = 'block';


    if (!localStream) {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        document.getElementById('user-1').srcObject = localStream;
    }

    localStream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, localStream)
    })

    peerConnection.ontrack = (event) => {
        event.streams[0].getTracks().forEach((track) => {
            remoteStream.addTrack(track)
        })
    }

    peerConnection.onicecandidate = async (event) => {
        if (event.candidate) {
            socket.emit("sendOffer", { "type": "candidate", "candidate": event.candidate, "MemberId": MemberId })
        }
    }
}
let createOffer = async (MemberId) => {
    await createPeerConnection(MemberId);
    let offer = await peerConnection.createOffer()
    await peerConnection.setLocalDescription(offer);
    socket.emit("sendOffer", { "type": "offer", "offer": offer, "MemberId": MemberId })
}
let createAnswer = async (MemberId, offer) => {
    await createPeerConnection(MemberId)
    await peerConnection.setRemoteDescription(offer);
    let answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    socket.emit("sendOffer", { "type": "answer", "answer": answer, "MemberId": MemberId })
}
let addAnswer = async (answer) => {
    if (!peerConnection.currentRemoteDescription) {
        peerConnection.setRemoteDescription(answer);
    }
}
let receiveOffer = async (data) => {
    if (data.type == "offer") {
        createAnswer(remoteSocketId, data.offer);
    }
    if (data.type == "answer") {
        addAnswer(data.answer);
    }
    if (data.type == "candidate") {
        if (peerConnection) {
            peerConnection.addIceCandidate(data.candidate);
        }
    }
}
let handleUserJoined = async (message) => {
    //Update UI
    document.querySelectorAll('.room-buttons').forEach(element => {
        element.style.display = 'none';
    });
    //Logic for joined user
    if (localSocketId == message.value.joineeSocketId) {
        // Update UI
        document.getElementById("createRoomBtn").style.display = "none";
        document.getElementById("joinRoomInput").disabled = true;
        document.getElementById("copyRoomNameBtn").style.display = "block";
        console.log(message.message);
        remoteSocketId = message.value.creatorSocketId;
    }
    else {//Logic for room creator
        remoteSocketId = message.value.joineeSocketId;
        createOffer(remoteSocketId);
    }

}

/*****************************************##ROOM LOGIC##******************************************* */
socket.on("message", (message) => {
    if (message.message == "Room created successfully") {
        // Update UI to show file input after joining the room
        document.querySelectorAll('.room-buttons').forEach(element => {
            element.style.display = 'none';
        });
        document.getElementById("createRoomLabel").style.display = "block";
        document.getElementById("createRoomInput").style.display = "block";
        document.getElementById("joinRoomLabel").style.display = "none";
        document.getElementById("joinRoomInput").style.display = "none";
        document.getElementById("createRoomInput").value = message.value;
        document.getElementById("createRoomInput").disabled = true;
        document.getElementById("copyRoomNameBtn").style.display = "block";
        console.log("Room created successfully");
    }
    if (message.message == "Invalid Room Id") {
        console.log(message.message + ` : ${message.value}`);
    }
})


function createRoom() {
    socket.emit("createRoom", uuidv4());
}
function joinRoom() {
    let roomName = document.getElementById("joinRoomInput").value;
    if (roomName.length) {
        socket.emit("joinRoom", roomName);
    }
    else {
        console.log("Please provide Room Name");
    }
}
function copyRoomId() {
    const createRoomInput = document.getElementById("createRoomInput");
    let roomValue = createRoomInput.value;
    if (!roomValue.length) {
        const joinRoomInput = document.getElementById("joinRoomInput");
        roomValue = joinRoomInput.value;
    }

    // Use modern clipboard API
    navigator.clipboard.writeText(roomValue)
        .then(() => {
            console.log("Room ID copied to clipboard!");
        })
        .catch((err) => {
            console.error('Unable to copy to clipboard', err);
        });
}
let toggleCamera = async () => {
    let videoTrack = localStream.getTracks().find(track => track.kind === 'video')

    if (videoTrack.enabled) {
        videoTrack.enabled = false
        document.getElementById('camera-btn').style.backgroundColor = 'rgb(255, 80, 80)'
    } else {
        videoTrack.enabled = true
        document.getElementById('camera-btn').style.backgroundColor = 'rgb(179, 102, 249, .9)'
    }
}

let toggleMic = async () => {
    let audioTrack = localStream.getTracks().find(track => track.kind === 'audio')

    if (audioTrack.enabled) {
        audioTrack.enabled = false
        document.getElementById('mic-btn').style.backgroundColor = 'rgb(255, 80, 80)'
    } else {
        audioTrack.enabled = true
        document.getElementById('mic-btn').style.backgroundColor = 'rgb(179, 102, 249, .9)'
    }
}
/********************************************************************************* */

socket.on('Connection Established', (socketId) => {
    localSocketId = socketId;
    alert("Connected to server");
})
socket.on('handleUserJoined', handleUserJoined);
socket.on('receiveOffer', receiveOffer);
socket.on('joinedUserLeft', () => {
    document.getElementById('user-2').style.display = 'none';
});
socket.on('creatorLeft', () => {
    document.getElementById('user-2').style.display = 'none';
    window.location.reload();
})

document.getElementById('camera-btn').addEventListener('click', toggleCamera)
document.getElementById('mic-btn').addEventListener('click', toggleMic)
init();