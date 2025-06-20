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
let tempMarkerGroup; // Група для тимчасових маркерів
let allMarkersGroup; // Група для всіх маркерів спогадів
let isFormOpen = false;

// Змінні для пагінації
const MEMORIES_PER_PAGE = 50;
let lastVisibleMemory = null;
let isLoadingMemories = false;
let allMemoriesLoaded = false;

// Визначення, чи є пристрій мобільним
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
console.log("Мобільний пристрій:", isMobile);

// Ініціалізація карти
function initMap() {
    // Створення карти
    map = L.map('map', {
        tap: true,
        dragging: true,
        tapTolerance: 15,
        bounceAtZoomLimits: true
    }).setView([50.4501, 30.5234], 5);
    
    // Додавання шару карти
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);
    
    // Створення груп для маркерів
    tempMarkerGroup = L.layerGroup().addTo(map);
    allMarkersGroup = L.layerGroup().addTo(map);
    
    // Обробник подій для карти, адаптований для мобільних пристроїв
    if (isMobile) {
        map.on('tap', handleMapInteraction);
    } else {
        map.on('click', handleMapInteraction);
    }
    
    // Завантаження спогадів з пагінацією
    loadMemoriesWithPagination();
    
    // Додаємо обробник для завантаження додаткових спогадів при переміщенні карти
    map.on('moveend', function() {
        if (!isLoadingMemories && !allMemoriesLoaded) {
            loadMoreMemoriesIfNeeded();
        }
    });
    
    // Додаємо кнопку для вибору локації на мобільних пристроях
    if (isMobile) {
        const formElement = document.getElementById('add-form');
        const locationText = document.getElementById('location-text');
        
        const selectLocationBtn = document.createElement('button');
        selectLocationBtn.id = 'select-location';
        selectLocationBtn.textContent = 'Обрати поточне місце на карті';
        selectLocationBtn.className = 'mobile-btn';
        
        // Вставляємо кнопку після тексту про локацію
        locationText.parentNode.insertBefore(selectLocationBtn, locationText.nextSibling);
        
        selectLocationBtn.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Закриваємо форму тимчасово
            document.getElementById('memory-form').classList.add('hidden');
            
            // Показуємо повідомлення
            alert("Перемістіть карту до потрібного місця і натисніть 'OK'. Потім натисніть на карту, щоб вибрати точне місце.");
            
            // Відкриваємо форму знову після закриття повідомлення
            setTimeout(() => {
                document.getElementById('memory-form').classList.remove('hidden');
            }, 300);
        });
    }
}

// Обробник взаємодії з картою
function handleMapInteraction(e) {
    if (document.getElementById('memory-form').classList.contains('hidden')) {
        return; // Якщо форма закрита, не реагуємо на кліки по карті
    }
    
    selectedLocation = e.latlng;
    document.getElementById('location-text').textContent = 
        `Обрано: ${selectedLocation.lat.toFixed(4)}, ${selectedLocation.lng.toFixed(4)}`;
    
    // Очищаємо групу тимчасових маркерів і додаємо новий
    tempMarkerGroup.clearLayers();
    L.marker([selectedLocation.lat, selectedLocation.lng]).addTo(tempMarkerGroup);
}

// Завантаження спогадів з пагінацією
function loadMemoriesWithPagination(forceReload = false) {
    if (isLoadingMemories) return;
    
    isLoadingMemories = true;
    
    if (forceReload) {
        allMarkersGroup.clearLayers();
        lastVisibleMemory = null;
        allMemoriesLoaded = false;
    }
    
    let query = db.collection("memories")
        .orderBy("createdAt", "desc")
        .limit(MEMORIES_PER_PAGE);
    
    if (lastVisibleMemory) {
        query = query.startAfter(lastVisibleMemory);
    }
    
    query.get().then(snapshot => {
        if (snapshot.empty) {
            allMemoriesLoaded = true;
            isLoadingMemories = false;
            return;
        }
        
        // Зберігаємо останній документ для пагінації
        lastVisibleMemory = snapshot.docs[snapshot.docs.length - 1];
        
        snapshot.forEach(doc => {
            const data = doc.data();
            
            if (data.location && data.location.lat && data.location.lng) {
                const marker = L.marker([data.location.lat, data.location.lng])
                    .bindPopup(`<b>${data.title}</b><br>${data.date || 'Без дати'}`);
                
                // Для мобільних використовуємо інший обробник
                if (isMobile) {
                    marker.on('popupopen', () => {
                        setTimeout(() => {
                            showMemoryDetails(doc.id);
                            marker.closePopup();
                        }, 300);
                    });
                } else {
                    marker.on('click', () => {
                        showMemoryDetails(doc.id);
                    });
                }
                
                marker.memoryId = doc.id; // Зберігаємо ID для подальшого використання
                allMarkersGroup.addLayer(marker);
            }
        });
        
        isLoadingMemories = false;
    }).catch(error => {
        console.error("Помилка завантаження спогадів:", error);
        alert("Помилка завантаження спогадів. Спробуйте оновити сторінку.");
        isLoadingMemories = false;
    });
}

// Завантаження додаткових спогадів при необхідності
function loadMoreMemoriesIfNeeded() {
    // Якщо на карті менше 100 маркерів, завантажуємо ще
    if (Object.keys(allMarkersGroup._layers).length < 100 && !allMemoriesLoaded) {
        loadMemoriesWithPagination();
    }
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
                if (data.mediaType && data.mediaType.startsWith('video/')) {
                    const video = document.createElement('video');
                    video.controls = true;
                    video.src = data.mediaUrl;
                    mediaContainer.appendChild(video);
                } else {
                    const img = document.createElement('img');
                    img.src = data.mediaUrl;
                    img.alt = data.title;
                    img.loading = "lazy"; // Lazy loading для зображень
                    mediaContainer.appendChild(img);
                }
            }
            
            document.getElementById('memory-details').classList.remove('hidden');
        }
    }).catch(error => {
        console.error("Помилка отримання деталей:", error);
        alert("Помилка завантаження деталей спогаду.");
    });
}

// Закрити деталі спогаду
document.getElementById('close-details').addEventListener('click', () => {
    document.getElementById('memory-details').classList.add('hidden');
});

// Відображення форми додавання спогаду
document.getElementById('add-memory').addEventListener('click', () => {
    document.getElementById('memory-form').classList.remove('hidden');
    document.getElementById('location-text').textContent = "Оберіть місце на карті";
    isFormOpen = true;
    
    // Для мобільних пристроїв показуємо підказку
    if (isMobile) {
        setTimeout(() => {
            alert("Натисніть на карту, щоб вибрати місце для спогаду");
        }, 300);
    }
});

// Скасування додавання спогаду
document.getElementById('cancel').addEventListener('click', () => {
    document.getElementById('memory-form').classList.add('hidden');
    document.getElementById('add-form').reset();
    document.getElementById('location-text').textContent = "Оберіть місце на карті";
    
    tempMarkerGroup.clearLayers();
    selectedLocation = null;
    isFormOpen = false;
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
    
    // Показуємо індикатор завантаження
    const loadingText = document.createElement('p');
    loadingText.textContent = "Зберігаємо спогад...";
    loadingText.id = "loading-text";
    loadingText.style.textAlign = "center";
    loadingText.style.marginTop = "10px";
    document.getElementById('add-form').appendChild(loadingText);
    
    // Блокуємо кнопки
    const buttons = document.querySelectorAll('#add-form button');
    buttons.forEach(btn => btn.disabled = true);
    
    // Функція збереження спогаду
    function saveMemory(mediaUrl = null, mediaType = null) {
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
            mediaType: mediaType,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        db.collection("memories").add(memoryData)
        .then(() => {
            alert("Спогад успішно додано!");
            document.getElementById('cancel').click();
            loadMemoriesWithPagination(true); // Перезавантажуємо спогади
        })
        .catch(error => {
            console.error("Помилка додавання спогаду:", error);
            alert("Помилка: " + error.message);
            
            // Розблоковуємо кнопки
            buttons.forEach(btn => btn.disabled = false);
            // Видаляємо індикатор завантаження
            const loadingText = document.getElementById('loading-text');
            if (loadingText) loadingText.remove();
        });
    }
    
    // Якщо є файл - завантажуємо його
    if (mediaFile) {
        // Перевіряємо розмір файлу (максимум 5 МБ)
        if (mediaFile.size > 5 * 1024 * 1024) {
            alert("Файл занадто великий. Максимальний розмір - 5 МБ.");
            
            // Розблоковуємо кнопки
            buttons.forEach(btn => btn.disabled = false);
            // Видаляємо індикатор завантаження
            const loadingText = document.getElementById('loading-text');
            if (loadingText) loadingText.remove();
            
            return;
        }
        
        const uniqueId = Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        const storageRef = storage.ref(`memories/${uniqueId}_${mediaFile.name}`);
        storageRef.put(mediaFile)
            .then(snapshot => snapshot.ref.getDownloadURL())
            .then(url => saveMemory(url, mediaFile.type))
            .catch(error => {
                console.error("Помилка завантаження файлу:", error);
                alert("Помилка завантаження файлу: " + error.message);
                
                // Розблоковуємо кнопки
                buttons.forEach(btn => btn.disabled = false);
                // Видаляємо індикатор завантаження
                const loadingText = document.getElementById('loading-text');
                if (loadingText) loadingText.remove();
            });
    } else {
        saveMemory();
    }
});

// Покращений обробник для запобігання небажаному масштабуванню
let initialPinchDistance = 0;
let initialZoom = 0;

document.addEventListener('touchstart', function(e) {
    if (e.touches.length === 2) {
        // Pinch-zoom починається
        initialPinchDistance = Math.hypot(
            e.touches[0].pageX - e.touches[1].pageX,
            e.touches[0].pageY - e.touches[1].pageY
        );
        
        if (map) {
            initialZoom = map.getZoom();
        }
    }
}, { passive: true });

document.addEventListener('touchmove', function(e) {
    if (e.touches.length === 2) {
        // Перевіряємо, чи відкрита форма або деталі
        const isFormVisible = !document.getElementById('memory-form').classList.contains('hidden');
        const isDetailsVisible = !document.getElementById('memory-details').classList.contains('hidden');
        
        if (isFormVisible || isDetailsVisible) {
            // Дозволяємо масштабування тільки на карті
            const touch1 = e.touches[0];
            const touch2 = e.touches[1];
            
            const mapElement = document.getElementById('map');
            const mapRect = mapElement.getBoundingClientRect();
            
            const touch1OnMap = 
                touch1.clientX >= mapRect.left && touch1.clientX <= mapRect.right &&
                touch1.clientY >= mapRect.top && touch1.clientY <= mapRect.bottom;
                
            const touch2OnMap = 
                touch2.clientX >= mapRect.left && touch2.clientX <= mapRect.right &&
                touch2.clientY >= mapRect.top && touch2.clientY <= mapRect.bottom;
            
            if (!touch1OnMap || !touch2OnMap) {
                e.preventDefault();
            }
        }
    }
}, { passive: false });

// Ініціалізація карти після завантаження сторінки
document.addEventListener('DOMContentLoaded', function() {
    // Ініціалізуємо карту з невеликою затримкою для мобільних пристроїв
    setTimeout(initMap, isMobile ? 1000 : 0);
});
