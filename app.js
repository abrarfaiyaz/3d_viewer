// Scene initialization
let scene = new THREE.Scene();
let camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 0, 20); // Move the camera back to see the graph

// Renderer setup
let renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Lighting
let ambientLight = new THREE.AmbientLight(0x404040, 2);
scene.add(ambientLight);

let directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(10, 10, 10);
scene.add(directionalLight);

// OrbitControls for camera interaction
let controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;

// Raycaster and mouse for detecting clicks/touches
let raycaster = new THREE.Raycaster();
let mouse = new THREE.Vector2();

// Array to store node meshes and labels
let nodeMeshes = [];
let labels = {};
let labeledNodesList = {};  // Stores labeled nodes for persistence

// Mode variable to switch between 'transform' and 'select'
let mode = 'transform';
let modeButton = document.getElementById('modeButton');
let resetButton = document.getElementById('resetButton');
let labelList = document.getElementById('labelList');

// Debugging information
console.log("Selection Mode Initialized");

// Function to create a 3D sprite label
function createSpriteLabel(text) {
    let canvas = document.createElement('canvas');
    let context = canvas.getContext('2d');
    context.font = 'Bold 24px Arial';
    context.fillStyle = 'white';
    context.strokeStyle = 'black';
    context.lineWidth = 4;

    // Calculate text size and adjust canvas size
    let textWidth = context.measureText(text).width;
    canvas.width = textWidth + 10;
    canvas.height = 40; // Fixed height for labels

    // Draw the text
    context.strokeText(text, 5, 30);
    context.fillText(text, 5, 30);

    // Create texture and sprite
    let texture = new THREE.CanvasTexture(canvas);
    let material = new THREE.SpriteMaterial({ map: texture });
    let sprite = new THREE.Sprite(material);
    sprite.scale.set(2, 1, 1);  // Adjust size of the label

    return sprite;
}

// Function to add a label to a node
function addLabelToNode(node, text) {
    let label = createSpriteLabel(text);
    label.position.copy(node.position);  // Set the label at the same position as the node
    scene.add(label);
    return label;
}

// Function to load graph data from a JSON file
function loadGraphData() {
    fetch('graph_data.json') // Assuming the JSON file exists
        .then(response => response.json())
        .then(data => {
            data.nodes.forEach((node, index) => {
                let position = new THREE.Vector3(node.x, node.y, node.z);
                let geometry = new THREE.SphereGeometry(0.5, 32, 32);
                let material = new THREE.MeshPhongMaterial({ color: 0xff0000, shininess: 100 });
                let sphere = new THREE.Mesh(geometry, material);
                sphere.position.copy(position);
                scene.add(sphere);
                nodeMeshes.push(sphere);  // Store the node mesh for raycasting
            });

            // Create edges
            data.edges.forEach(edge => {
                let fromNode = nodeMeshes[edge.from].position;
                let toNode = nodeMeshes[edge.to].position;
                let edgeGeometry = new THREE.BufferGeometry().setFromPoints([fromNode, toNode]);
                let edgeMaterial = new THREE.LineBasicMaterial({ color: 0x0000ff });
                let line = new THREE.Line(edgeGeometry, edgeMaterial);
                scene.add(line);
            });

            // Reload any previously stored labels
            for (let nodeId in labeledNodesList) {
                let label = addLabelToNode(nodeMeshes[nodeId], labeledNodesList[nodeId]);
                labels[nodeId] = label;
            }
        })
        .catch(error => console.error('Error loading graph data:', error));
}

// Function to clear existing labels
function clearLabels() {
    for (let nodeId in labels) {
        scene.remove(labels[nodeId]);
        delete labels[nodeId];
    }
}

// Node selection handler
function onSelectNode(event) {
    if (mode !== 'select') return;

    event.preventDefault();

    let clientX = event.clientX || event.changedTouches[0].clientX;
    let clientY = event.clientY || event.changedTouches[0].clientY;

    // Convert screen coordinates to normalized device coordinates
    mouse.x = (clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(clientY / window.innerHeight) * 2 + 1;

    console.log("Mouse coordinates: ", mouse);  // Debugging: check the mouse coordinates

    // Update raycaster with camera and pointer position
    raycaster.setFromCamera(mouse, camera);

    // Find intersections (clicked/touched nodes)
    let intersects = raycaster.intersectObjects(nodeMeshes);
    if (intersects.length > 0) {
        let clickedNode = intersects[0].object;
        console.log("Node Selected:", clickedNode);  // Debugging: check which node is selected

        let labelText = prompt("Enter label for this node:");
        if (labelText) {
            if (labels[clickedNode.id]) {
                scene.remove(labels[clickedNode.id]);  // Remove old label
            }

            // Add the new label and store it
            let label = addLabelToNode(clickedNode, labelText);
            labels[clickedNode.id] = label;

            // Store the label in the list for persistence
            labeledNodesList[clickedNode.id] = labelText;
            updateLabelList(clickedNode.id, labelText);
        }
    } else {
        console.log("No node selected.");  // Debugging: No intersection found
    }
}

// Function to update the labeled nodes list in the UI
function updateLabelList(nodeId, labelText) {
    let listItem = document.createElement('li');
    listItem.innerText = `Node ${nodeId}: ${labelText}`;
    labelList.appendChild(listItem);
}

// Reset function to clear stored labels and refresh the page
resetButton.addEventListener('click', () => {
    localStorage.clear();
    location.reload();
});

// Switch between 'transform' and 'select' modes
modeButton.addEventListener('click', () => {
    if (mode === 'transform') {
        mode = 'select';
        controls.enabled = false;  // Disable OrbitControls in select mode
        modeButton.innerHTML = 'Switch to Transform Mode';

        // Clear current labels from the scene but keep the list intact
        clearLabels();

        // Reload graph and labels without resetting the node list
        loadGraphData();
    } else {
        mode = 'transform';
        controls.enabled = true;  // Enable OrbitControls in transform mode
        modeButton.innerHTML = 'Switch to Selection Mode';

        // Clear current labels from the scene but keep the list intact
        clearLabels();

        // Reload graph and labels without resetting the node list
        loadGraphData();
    }
});

// Handle window resizing
window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
});

// Render function
function render() {
    controls.update();  // Update camera controls
    renderer.render(scene, camera);
}

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    render();
}

// Load graph data and start the animation
loadGraphData();
animate();
