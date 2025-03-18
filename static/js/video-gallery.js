const VideoGallery = (function() {
    let animationFrameId = null;
    // Track current index for each gallery
    const currentIndices = {};

    function syncVideos(videos) {
        const primary = videos[0];
        const others = Array.from(videos).slice(1);
        
        function checkSync() {
            others.forEach(video => {
                const timeDiff = Math.abs(primary.currentTime - video.currentTime);
                if (timeDiff > 0.016) {
                    video.currentTime = primary.currentTime;
                }
            });

            if (!primary.paused && others.every(v => !v.paused)) {
                animationFrameId = requestAnimationFrame(checkSync);
            }
        }

        return checkSync;
    }

    async function playVideos(videos) {
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
        }

        videos.forEach(video => {
            video.currentTime = 0;
            video.muted = true;
            video.playsInline = true;
            video.setAttribute('autoplay', '');
        });

        try {
            for (let video of videos) {
                await video.play();
            }

            const checkSync = syncVideos(videos);
            animationFrameId = requestAnimationFrame(checkSync);

            const handleTimeUpdate = function() {
                if (this.currentTime >= this.duration - 0.1) {
                    videos.forEach(v => {
                        v.currentTime = 0;
                        v.play().catch(e => console.log("Replay failed:", e));
                    });
                }
            };

            videos[0].addEventListener('timeupdate', handleTimeUpdate);
        } catch (error) {
            console.log("Playback failed:", error);
            setTimeout(() => playVideos(videos), 100);
        }
    }

    function loadVideos(videos) {
        return Promise.all(
            Array.from(videos).map(video => {
                return new Promise((resolve, reject) => {
                    // For already loaded videos
                    if (video.readyState >= 4) {
                        resolve(video);
                        return;
                    }

                    // For videos that need loading
                    const loadHandler = () => {
                        video.removeEventListener('loadeddata', loadHandler);
                        resolve(video);
                    };
                    video.addEventListener('loadeddata', loadHandler);
                    video.addEventListener('error', (e) => reject(e));
                    
                    // Ensure video starts loading
                    video.load();
                });
            })
        );
    }

    function handleVideoSwitch(galleryId, index) {
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }

        const container = document.getElementById(galleryId);
        const videoSets = container.querySelectorAll('.video-single, .video-pair, .video-triple');
        const totalVideos = videoSets.length;
        
        // Apply modulo to wrap around the index
        index = (index + totalVideos) % totalVideos;
        
        // Update current index for this gallery
        currentIndices[galleryId] = index;
        
        // Update dot navigation
        updateDots(galleryId, index);
        
        videoSets.forEach(set => {
            const videos = set.querySelectorAll('video');
            videos.forEach(video => {
                video.pause();
                video.currentTime = 0;
                video.replaceWith(video.cloneNode(true));
            });
            set.classList.remove('active');
        });

        const selectedSet = videoSets[index];
        selectedSet.classList.add('active');
        const videosToPlay = selectedSet.querySelectorAll('video');

        videosToPlay.forEach(video => {
            video.muted = true;
            video.playsInline = true;
            video.setAttribute('autoplay', '');
        });

        loadVideos(videosToPlay)
            .then(() => {
                playVideos(videosToPlay);
                // Explicitly start playing each video
                videosToPlay.forEach(video => {
                    video.play().catch(e => console.log("Play failed:", e));
                });
            })
            .catch(error => {
                console.error("Error loading videos:", error);
            });
    }
    
    // Function to create and update dot navigation
    function createDots(galleryId, count, activeIndex) {
        const dotsContainer = document.getElementById(`${galleryId}-dots`);
        if (!dotsContainer) return;
        
        // Clear existing dots
        dotsContainer.innerHTML = '';
        
        // Create dots
        for (let i = 0; i < count; i++) {
            const dot = document.createElement('span');
            dot.className = 'gallery-dot';
            if (i === activeIndex) {
                dot.classList.add('active');
            }
            
            // Add click event to each dot
            dot.addEventListener('click', () => {
                handleVideoSwitch(galleryId, i);
            });
            
            dotsContainer.appendChild(dot);
        }
    }
    
    // Function to update dot navigation
    function updateDots(galleryId, activeIndex) {
        const dotsContainer = document.getElementById(`${galleryId}-dots`);
        if (!dotsContainer) return;
        
        // Update active state
        const dots = dotsContainer.querySelectorAll('.gallery-dot');
        dots.forEach((dot, i) => {
            if (i === activeIndex) {
                dot.classList.add('active');
            } else {
                dot.classList.remove('active');
            }
        });
    }

    function initGallery(galleryId) {
        const container = document.getElementById(galleryId);
        if (!container) return; // Skip if gallery doesn't exist
        
        const videoSets = container.querySelectorAll('.video-single, .video-pair, .video-triple');
        const totalVideos = videoSets.length;
        
        // Initialize current index for this gallery
        const initialIndex = Array.from(videoSets).findIndex(set => set.classList.contains('active'));
        currentIndices[galleryId] = initialIndex >= 0 ? initialIndex : 0;
        
        // Create dot navigation
        createDots(galleryId, totalVideos, currentIndices[galleryId]);
        
        // Set up arrow navigation buttons
        const prevBtn = document.querySelector(`#${galleryId}-prev`);
        const nextBtn = document.querySelector(`#${galleryId}-next`);
        
        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                const currentIndex = currentIndices[galleryId];
                // Navigate to previous, wrap to end if at beginning
                handleVideoSwitch(galleryId, currentIndex - 1);
            });
        }
        
        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                const currentIndex = currentIndices[galleryId];
                // Navigate to next, wrap to beginning if at end
                handleVideoSwitch(galleryId, currentIndex + 1);
            });
        }

        // Initialize first active set (either pair or triple)
        const firstActiveSet = container.querySelector('.video-single.active, .video-pair.active, .video-triple.active');
        if (firstActiveSet) {
            const initialVideos = firstActiveSet.querySelectorAll('video');
            
            // Prepare initial videos
            initialVideos.forEach(video => {
                video.muted = true;
                video.playsInline = true;
                video.setAttribute('autoplay', '');
            });

            // Load and play initial videos
            loadVideos(initialVideos)
                .then(() => {
                    playVideos(initialVideos);
                    // Explicitly start playing each video
                    initialVideos.forEach(video => {
                        video.play().catch(e => console.log("Initial play failed:", e));
                    });
                })
                .catch(error => {
                    console.error("Error loading initial videos:", error);
                });
        }
    }

    function cleanup() {
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
    }

    return {
        init: function() {
            // Initialize each gallery with their IDs
            initGallery('gallery-carousel-long');
            initGallery('gallery-carousel-replacement');
            initGallery('gallery-carousel-style');
            initGallery('gallery-carousel-adjustment');
        },
        cleanup: cleanup
    };
})();

// Initialize when the page loads
document.addEventListener('DOMContentLoaded', function() {
    VideoGallery.init();
});

window.addEventListener('unload', function() {
    VideoGallery.cleanup();
});

// Backup initialization
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    VideoGallery.init();
}