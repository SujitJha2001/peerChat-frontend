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
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        const localVideo = document.getElementById('user-1');
        localVideo.srcObject = localStream;
        
        // Set initial transform for front camera (default is user/selfie camera)
        if (currentCamera === 'user') {
            localVideo.style.transform = 'scaleX(-1)';
        } else {
            localVideo.style.transform = 'scaleX(1)';
        }
        
        // Check if device supports multiple cameras (for flip camera functionality)
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        
        // Hide flip camera button if device has only one camera
        if (videoDevices.length <= 1) {
            document.getElementById('flip-camera-btn').style.display = 'none';
        }
    } catch (error) {
        console.error('Error accessing media devices:', error);
        alert('Could not access camera or microphone. Please check your device permissions.');
    }
}
let createPeerConnection = async (MemberId) => {
    peerConnection = new RTCPeerConnection(servers);

    remoteStream = new MediaStream();
    const remoteVideo = document.getElementById('user-2');
    remoteVideo.srcObject = remoteStream;
    remoteVideo.style.display = 'block';
    
    // Ensure remote video is not mirrored - apply multiple ways to override any mirroring
    remoteVideo.style.transform = 'scaleX(1) !important';
    remoteVideo.style.webkitTransform = 'scaleX(1)';
    remoteVideo.style.mozTransform = 'scaleX(1)';
    remoteVideo.setAttribute('data-mirrored', 'false');
    
    // Add connection-active class to body to minimize room controls
    document.body.classList.add('connection-active');
    
    // Update layout for two participants
    updateVideoLayout();


    if (!localStream) {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        document.getElementById('user-1').srcObject = localStream;
    }

    localStream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, localStream)
    })

    peerConnection.ontrack = (event) => {
        event.streams[0].getTracks().forEach((track) => {
            remoteStream.addTrack(track)
        })
        
        // Ensure remote video is still not mirrored after tracks are added
        const remoteVideo = document.getElementById('user-2');
        remoteVideo.style.transform = 'scaleX(1) !important';
        remoteVideo.style.webkitTransform = 'scaleX(1)';
        remoteVideo.style.mozTransform = 'scaleX(1)';
        remoteVideo.setAttribute('data-mirrored', 'false');
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
            // Show feedback to user
            const copyButton = document.getElementById("copyRoomNameBtn");
            const originalText = copyButton.textContent;
            copyButton.textContent = "Copied!";
            setTimeout(() => {
                copyButton.textContent = originalText;
            }, 2000);
        })
        .catch((err) => {
            console.error('Unable to copy to clipboard', err);
        });
}

// Function to update video layout based on number of participants
function updateVideoLayout() {
    const user2 = document.getElementById('user-2');
    const videoContainer = document.getElementById('videos');
    const isMobile = window.innerWidth <= 768;
    
    // Handle two-participants layout
    if (user2.style.display === 'block') {
        videoContainer.classList.add('two-participants');
    } else {
        videoContainer.classList.remove('two-participants');
    }
    
    // Check if we're on mobile and adjust accordingly
    if (isMobile) {
        videoContainer.classList.add('mobile-view');
    } else {
        videoContainer.classList.remove('mobile-view');
    }
    
    // Add connected-state class if we're in a room (even without second participant)
    if (document.getElementById('copyRoomNameBtn').style.display === 'block') {
        videoContainer.classList.add('connected-state');
        document.body.classList.add('connection-active');
    } else {
        videoContainer.classList.remove('connected-state');
        document.body.classList.remove('connection-active');
    }
    
    // Mobile-specific adjustments for vertical stacking
    if (isMobile && document.body.classList.contains('connection-active')) {
        if (user2.style.display === 'block') {
            // Ensure videos take exactly 50% of viewport height each
            document.querySelectorAll('.video-player').forEach(video => {
                video.style.height = '50vh';
                video.style.maxHeight = '50vh';
                video.style.minHeight = 'auto';
                video.style.width = '100%';
                video.style.borderRadius = '0';
            });
            
            // Ensure user-1 (you) is at the bottom and user-2 (other person) is at the top
            document.getElementById('user-1').style.order = '2';
            document.getElementById('user-2').style.order = '1';
            
            // Apply mirroring based on which camera is active
            if (currentCamera === 'user') {
                // Front camera - mirror the video
                document.getElementById('user-1').style.transform = 'scaleX(-1)';
            } else {
                // Back camera - do not mirror
                document.getElementById('user-1').style.transform = 'scaleX(1)';
            }
            
            // Multiple approaches to ensure remote video is NOT mirrored
            const remoteVideo = document.getElementById('user-2');
            remoteVideo.style.transform = 'scaleX(1) !important';
            remoteVideo.style.webkitTransform = 'scaleX(1)';
            remoteVideo.style.mozTransform = 'scaleX(1)';
            remoteVideo.setAttribute('data-mirrored', 'false');
        } else {
            // Single participant in mobile view - full height
            document.getElementById('user-1').style.height = '100vh';
            document.getElementById('user-1').style.maxHeight = '100vh';
        }
    } else if (!isMobile) {
        // Desktop layout - ensure room controls don't overlap with video controls
        
        // Adjust the video container to make room for the room controls
        if (document.body.classList.contains('connection-active')) {
            videoContainer.style.marginTop = '60px';
        } else {
            videoContainer.style.marginTop = '';
        }
        
        // Desktop layout
        if (window.innerHeight > window.innerWidth) {
            // Portrait desktop mode
            if (user2.style.display === 'block') {
                document.querySelectorAll('.video-player').forEach(video => {
                    video.style.maxHeight = '40vh';
                    video.style.borderRadius = '12px';
                    video.style.order = '';
                });
            } else {
                document.getElementById('user-1').style.maxHeight = '70vh';
                document.getElementById('user-1').style.borderRadius = '12px';
                document.getElementById('user-1').style.order = '';
            }
        } else {
            // Landscape desktop mode
            if (user2.style.display === 'block') {
                document.querySelectorAll('.video-player').forEach(video => {
                    video.style.maxHeight = '65vh';
                    video.style.borderRadius = '12px';
                    video.style.order = '';
                });
            } else {
                document.getElementById('user-1').style.maxHeight = '70vh';
                document.getElementById('user-1').style.borderRadius = '12px';
                document.getElementById('user-1').style.order = '';
            }
        }
    }
    
    // Adjust room controls position to avoid overlap with video controls
    const roomControls = document.querySelector('.room-controls');
    const controlsElement = document.getElementById('controls');
    
    if (document.body.classList.contains('connection-active')) {
        if (isMobile) {
            roomControls.style.top = '5px';
            roomControls.style.right = '5px';
            roomControls.style.left = 'auto';
        } else {
            // Desktop view - ensure clear separation
            roomControls.style.position = 'fixed';
            roomControls.style.top = '10px';
            roomControls.style.right = '10px';
            roomControls.style.left = 'auto';
            
            // Make sure controls are at bottom with enough clearance
            controlsElement.style.bottom = '20px';
            controlsElement.style.top = 'auto';
        }
    } else {
        roomControls.style.position = '';
        roomControls.style.top = '';
        roomControls.style.right = '';
        roomControls.style.left = '';
        controlsElement.style.bottom = '';
        controlsElement.style.top = '';
    }
}

// Handle window resize for responsive layout
window.addEventListener('resize', updateVideoLayout);
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
    let audioTrack = localStream.getTracks().find(track => track.kind === 'audio');
    
    if (!audioTrack) {
        console.error('No audio track found in stream');
        return;
    }
    
    // Toggle the enabled state
    audioTrack.enabled = !audioTrack.enabled;
    
    // Update UI to reflect the current state
    document.getElementById('mic-btn').style.backgroundColor = 
        audioTrack.enabled ? 'rgb(179, 102, 249, .9)' : 'rgb(255, 80, 80)';
    
    console.log(`Microphone ${audioTrack.enabled ? 'unmuted' : 'muted'}`);
    
    // If we're in a call, ensure the track state is properly reflected
    if (peerConnection) {
        // Find the audio sender
        const senders = peerConnection.getSenders();
        const audioSender = senders.find(sender => 
            sender.track && sender.track.kind === 'audio'
        );
        
        if (audioSender && audioSender.track) {
            // Update the track's enabled state to match our local track
            audioSender.track.enabled = audioTrack.enabled;
        }
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
    updateVideoLayout();
});
socket.on('creatorLeft', () => {
    document.getElementById('user-2').style.display = 'none';
    updateVideoLayout();
    window.location.reload();
})

// Flip camera function for mobile devices
let currentCamera = 'user'; // 'user' is front camera, 'environment' is back camera
let flipCamera = async () => {
    try {
        // Store references to existing audio track state before stopping
        const existingAudioTrack = localStream ? localStream.getAudioTracks()[0] : null;
        const audioEnabled = existingAudioTrack ? existingAudioTrack.enabled : true;
        
        // Remember current audio device settings
        const audioTrackSettings = existingAudioTrack ? existingAudioTrack.getSettings() : null;
        
        // Stop video track only, preserve audio track if possible
        const videoTracks = localStream ? localStream.getVideoTracks() : [];
        videoTracks.forEach(track => track.stop());
        
        // Toggle between front and back camera
        currentCamera = currentCamera === 'user' ? 'environment' : 'user';
        
        // Get new stream with just the other camera (no audio)
        const videoStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: currentCamera },
            audio: false
        });
        
        // If we don't have an audio track or it's been stopped, get a new one
        let audioTrack = existingAudioTrack;
        if (!audioTrack || audioTrack.readyState === 'ended') {
            try {
                const audioStream = await navigator.mediaDevices.getUserMedia({ 
                    audio: true, 
                    video: false 
                });
                audioTrack = audioStream.getAudioTracks()[0];
            } catch (audioErr) {
                console.error('Could not get audio stream:', audioErr);
                // Continue without audio if we can't get it
            }
        }
        
        // Create a new combined stream
        const newStream = new MediaStream();
        
        // Add video track from new stream
        const videoTrack = videoStream.getVideoTracks()[0];
        if (videoTrack) {
            newStream.addTrack(videoTrack);
        }
        
        // Add audio track if available
        if (audioTrack) {
            newStream.addTrack(audioTrack);
            // Important: Preserve the previous audio enabled state
            audioTrack.enabled = audioEnabled;
        }
        
        // Replace the old stream with the new one
        localStream = newStream;
        
        // Update local video
        document.getElementById('user-1').srcObject = localStream;
        
        // Update CSS based on camera mode
        const localVideo = document.getElementById('user-1');
        if (currentCamera === 'user') {
            // Front camera - mirror the video (selfie view)
            localVideo.style.transform = 'scaleX(-1)';
        } else {
            // Back camera - do not mirror the video
            localVideo.style.transform = 'scaleX(1)';
        }
        
        // If we're in a call, we need to update the tracks in the peer connection
        if (peerConnection) {
            // Get all senders
            const senders = peerConnection.getSenders();
            
            // Update video track
            const videoSender = senders.find(sender => 
                sender.track && sender.track.kind === 'video'
            );
            
            if (videoSender && videoTrack) {
                videoSender.replaceTrack(videoTrack);
            } else if (videoTrack) {
                peerConnection.addTrack(videoTrack, localStream);
            }
            
            // Update audio track if needed
            const audioTrack = localStream.getAudioTracks()[0];
            if (audioTrack) {
                const audioSender = senders.find(sender => 
                    sender.track && sender.track.kind === 'audio'
                );
                
                if (audioSender) {
                    audioSender.replaceTrack(audioTrack);
                    // Ensure the track's enabled state matches our saved state
                    audioTrack.enabled = audioEnabled;
                } else {
                    peerConnection.addTrack(audioTrack, localStream);
                }
            }
        }
        
        // Update the button color to indicate which camera is active
        const flipBtn = document.getElementById('flip-camera-btn');
        flipBtn.style.backgroundColor = currentCamera === 'user' 
            ? 'rgba(0, 149, 255, 0.9)' 
            : 'rgba(255, 149, 0, 0.9)';
            
    } catch (error) {
        console.error('Error flipping camera:', error);
        alert('Could not switch camera. Your device might only have one camera or permissions are denied.');
    }
}

// Function to leave the room/end call
let leaveCall = async () => {
    if (peerConnection) {
        // Clean up and close peer connection
        peerConnection.close();
        peerConnection = null;
    }
    
    if (localStream) {
        // Stop all local tracks
        localStream.getTracks().forEach(track => {
            track.stop();
        });
    }
    
    // Remove connection-active class
    document.body.classList.remove('connection-active');
    
    // Reload the page to reset everything
    window.location.reload();
}

// Toggle room controls in mobile view
function toggleRoomControls() {
    const roomControls = document.querySelector('.room-controls');
    roomControls.classList.toggle('collapsed');
    
    // Update icon orientation
    const toggleIcon = document.querySelector('.toggle-icon');
    if (roomControls.classList.contains('collapsed')) {
        toggleIcon.textContent = '▲';
    } else {
        toggleIcon.textContent = '▼';
    }
}

document.getElementById('camera-btn').addEventListener('click', toggleCamera);
document.getElementById('mic-btn').addEventListener('click', toggleMic);
document.getElementById('flip-camera-btn').addEventListener('click', flipCamera);
document.getElementById('leave-btn').addEventListener('click', leaveCall);
document.getElementById('toggle-room-controls').addEventListener('click', toggleRoomControls);

// Initial layout update and room state management
socket.on('message', message => {
    if (message.message === "Room created successfully" || 
        message.message === "Room joined successfully") {
        // Add connection-active class when room is created or joined
        document.body.classList.add('connection-active');
        document.getElementById('videos').classList.add('connected-state');
        updateVideoLayout();
    }
});

// Run updateVideoLayout on load and orientation change
window.addEventListener('orientationchange', updateVideoLayout);
document.addEventListener('DOMContentLoaded', updateVideoLayout);
init();
