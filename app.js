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

// Retrieve labeled nodes from localStorage
let storedLabels = JSON.parse(localStorage.getItem('labeledNodes')) || {};
for (let nodeId in storedLabels) {
    let label = createLabel(storedLabels[nodeId]);
    labels[nodeId] = label;
    updateLabelList(nodeId, storedLabels[nodeId]);
}

// Mode variable to switch between 'transform' and 'select'
let mode = 'transform';
let modeButton = document.getElementById('modeButton');
let resetButton = document.getElementById('resetButton');
let labelList = document.getElementById('labelList');

// Create a label container to hold all labels
let labelContainer = document.createElement('div');
labelContainer.className = 'label-container';
document.body.appendChild(labelContainer);

// Function to create a label for a node
function createLabel(text) {
    let label = document.createElement('div');
    label.className = 'label';
    label.innerHTML = text;
    labelContainer.appendChild(label);
    return label;
}

// Update label position based on node's 3D position and camera perspective
function updateLabelPosition(label, node) {
    let vector = node.position.clone();
    vector.project(camera);

    let x = (vector.x * 0.5 + 0.5) * window.innerWidth;
    let y = (-vector.y * 0.5 + 0.5) * window.innerHeight;

    label.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px)`;
}

// Function to add a labeled node to the list in the UI
function updateLabelList(nodeId, labelText) {
    let li = document.createElement('li');
    li.innerText = `Node ${nodeId}: ${labelText}`;
    labelList.appendChild(li);
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
        })
        .catch(error => console.error('Error loading graph data:', error));
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

    // Update raycaster with camera and pointer position
    raycaster.setFromCamera(mouse, camera);

    // Find intersections (clicked/touched nodes)
    let intersects = raycaster.intersectObjects(nodeMeshes);
    if (intersects.length > 0) {
        let clickedNode = intersects[0].object;
        let labelText = prompt("Enter label for this node:");

        if (labelText) {
            if (labels[clickedNode.id]) {
                labels[clickedNode.id].innerHTML = labelText;
            } else {
                let label = createLabel(labelText);
                labels[clickedNode.id] = label;
            }

            // Update label position and store the label in localStorage
            updateLabelPosition(labels[clickedNode.id], clickedNode);
            storedLabels[clickedNode.id] = labelText;
            localStorage.setItem('labeledNodes', JSON.stringify(storedLabels));
            updateLabelList(clickedNode.id, labelText);
        }
    }
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

        // Ensure no duplicate event listeners
        document.removeEventListener('mouseup', onSelectNode, false);
        document.addEventListener('mouseup', onSelectNode, false);  // Add node selection listener
    } else {
        mode = 'transform';
        controls.enabled = true;  // Enable OrbitControls in transform mode
        modeButton.innerHTML = 'Switch to Selection Mode';

        // Remove node selection listener to prevent interference
        document.removeEventListener('mouseup', onSelectNode, false);
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

    // Update label positions for all labeled nodes
    for (let nodeId in labels) {
        updateLabelPosition(labels[nodeId], nodeMeshes[nodeId]);
    }

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
