// Firebase конфігурація
const firebaseConfig = {
  apiKey: "AIzaSyAy1XcgGbyDuJtAx-e05GOlsxlmth-LaLI",
  authDomain: "demand-ddfa6.firebaseapp.com",
  projectId: "demand-ddfa6",
  storageBucket: "demand-ddfa6.firebasestorage.app",
  messagingSenderId: "939171101678",
  appId: "1:939171101678:web:271dd228114b1f882e6cff",
  measurementId: "G-LGEWKJXX5W"
};

// Ініціалізація Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const storage = firebase.storage();

// Змінні для карти
let map;
let selectedLocation = null;
let tempMarker = null;
let allMarkers = [];

// Ініціалізація карти
function initMap() {
    map = L.map('map').setView([50.4501, 30.5234], 5);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);
    
    // Обробник кліку по карті
    map.on('click', function(e) {
        if (!document.getElementById('memory-form').classList.contains('hidden')) {
            selectedLocation = e.latlng;
            document.getElementById('location-text').textContent = 
                `Обрано: ${selectedLocation.lat.toFixed(4)}, ${selectedLocation.lng.toFixed(4)}`;
            
            // Додавання тимчасового маркера
            if (tempMarker) map.removeLayer(tempMarker);
            tempMarker = L.marker(selectedLocation).addTo(map);
        }
    });
    
    // Завантаження спогадів
    loadMemories();
}

// Завантаження спогадів з бази даних
function loadMemories() {
    // Очищення існуючих маркерів
    allMarkers.forEach(marker => map.removeLayer(marker));
    allMarkers = [];
    
    db.collection("memories").get().then(snapshot => {
        snapshot.forEach(doc => {
            const data = doc.data();
            const marker = L.marker([data.location.lat, data.location.lng])
                .addTo(map)
                .bindPopup(`<b>${data.title}</b><br>${data.date || 'Без дати'}`);
            
            marker.on('click', () => {
                showMemoryDetails(doc.id);
            });
            
            allMarkers.push(marker);
        });
    }).catch(error => {
        console.error("Помилка завантаження спогадів:", error);
    });
}

// Показати деталі спогаду
function showMemoryDetails(memoryId) {
    db.collection("memories").doc(memoryId).get().then(doc => {
        if (doc.exists) {
            const data = doc.data();
            
            document.getElementById('detail-title').textContent = data.title;
            document.getElementById('detail-date').textContent = data.date || 'Без дати';
            document.getElementById('detail-description').textContent = data.description;
            
            if (data.author) {
                document.getElementById('detail-author').textContent = `Автор: ${data.author}`;
                document.getElementById('detail-author').classList.remove('hidden');
            } else {
                document.getElementById('detail-author').classList.add('hidden');
            }
            
            const mediaContainer = document.getElementById('detail-media');
            mediaContainer.innerHTML = '';
            
            if (data.mediaUrl) {
                if (data.mediaUrl.includes('.mp4') || data.mediaUrl.includes('.webm')) {
                    const video = document.createElement('video');
                    video.controls = true;
                    video.src = data.mediaUrl;
                    mediaContainer.appendChild(video);
                } else {
                    const img = document.createElement('img');
                    img.src = data.mediaUrl;
                    mediaContainer.appendChild(img);
                }
            }
            
            document.getElementById('memory-details').classList.remove('hidden');
        }
    }).catch(error => {
        console.error("Помилка отримання деталей:", error);
    });
}

// Закрити деталі спогаду
document.getElementById('close-details').addEventListener('click', () => {
    document.getElementById('memory-details').classList.add('hidden');
});

// Відображення форми додавання спогаду
document.getElementById('add-memory').addEventListener('click', () => {
    document.getElementById('memory-form').classList.remove('hidden');
});

// Скасування додавання спогаду
document.getElementById('cancel').addEventListener('click', () => {
    document.getElementById('memory-form').classList.add('hidden');
    document.getElementById('add-form').reset();
    document.getElementById('location-text').textContent = "Оберіть місце на карті";
    
    if (tempMarker) {
        map.removeLayer(tempMarker);
        tempMarker = null;
    }
    selectedLocation = null;
});

// Додавання нового спогаду
document.getElementById('add-form').addEventListener('submit', function(e) {
    e.preventDefault();
    
    if (!selectedLocation) {
        alert("Будь ласка, оберіть місце на карті");
        return;
    }
    
    const title = document.getElementById('title').value;
    const description = document.getElementById('description').value;
    const date = document.getElementById('memory-date').value;
    const author = document.getElementById('author').value;
    const mediaFile = document.getElementById('media').files[0];
    
    // Функція збереження спогаду
    function saveMemory(mediaUrl = null) {
        const memoryData = {
            title: title,
            description: description,
            date: date,
            author: author,
            location: {
                lat: selectedLocation.lat,
                lng: selectedLocation.lng
            },
            mediaUrl: mediaUrl,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        db.collection("memories").add(memoryData)
        .then(() => {
            alert("Спогад успішно додано!");
            document.getElementById('cancel').click();
            loadMemories();
        })
        .catch(error => {
            console.error("Помилка додавання спогаду:", error);
            alert("Помилка: " + error.message);
        });
    }
    
    // Якщо є файл - завантажуємо його
    if (mediaFile) {
        const uniqueId = Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        const storageRef = storage.ref(`memories/${uniqueId}_${mediaFile.name}`);
        storageRef.put(mediaFile)
            .then(snapshot => snapshot.ref.getDownloadURL())
            .then(url => saveMemory(url))
            .catch(error => {
                console.error("Помилка завантаження файлу:", error);
                alert("Помилка завантаження файлу: " + error.message);
            });
    } else {
        saveMemory();
    }
});

// Ініціалізація карти після завантаження сторінки
document.addEventListener('DOMContentLoaded', initMap);
