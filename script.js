// parisien.cz - Script

// Gestion du carousel horizontal dans la section "À Visiter"

// Hero Slideshow
function heroSlideshow() {
    const slides = document.querySelectorAll('.slide');
    if (slides.length === 0) return;
    
    let currentSlide = 0;
    
    function showSlide(index) {
        slides.forEach(slide => slide.classList.remove('active'));
        slides[index].classList.add('active');
    }
    
    function nextSlide() {
        currentSlide = (currentSlide + 1) % slides.length;
        showSlide(currentSlide);
    }
    
    // Start slideshow
    setInterval(nextSlide, 5000); // Change slide every 5 seconds
}

// Initialize slideshow when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    heroSlideshow();
    
    // Gestion du carrousel horizontal
    const placesContainer = document.querySelector('.places');
    const prevButton = document.querySelector('.places-prev');
    const nextButton = document.querySelector('.places-next');
    
    if(placesContainer && prevButton && nextButton) {
        const scrollAmount = 320; // Largeur d'une carte + marge
        
        prevButton.addEventListener('click', function() {
            placesContainer.scrollBy({
                left: -scrollAmount,
                behavior: 'smooth'
            });
        });
        
        nextButton.addEventListener('click', function() {
            placesContainer.scrollBy({
                left: scrollAmount,
                behavior: 'smooth'
            });
        });
    }
});

// Sticky header effect
window.addEventListener('scroll', function() {
    const header = document.querySelector('header');
    if (window.scrollY > 100) {
        header.style.padding = '10px 5%';
        header.style.backgroundColor = 'rgba(255, 255, 255, 0.98)';
        header.style.boxShadow = '0 2px 15px rgba(0, 0, 0, 0.1)';
    } else {
        header.style.padding = '20px 5%';
        header.style.backgroundColor = 'rgba(255, 255, 255, 0.95)';
        header.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.05)';
    }
});

// Smooth scrolling for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        
        const targetId = this.getAttribute('href');
        const targetElement = document.querySelector(targetId);
        
        if (targetElement) {
            window.scrollTo({
                top: targetElement.offsetTop - 80,
                behavior: 'smooth'
            });
        }
    });
});

// Form submission handling
const contactForm = document.querySelector('.contact-form');
if (contactForm) {
    contactForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        // Get form values
        const name = document.getElementById('name').value;
        const email = document.getElementById('email').value;
        const message = document.getElementById('message').value;
        
        // Basic validation
        if (!name || !email || !message) {
            alert('Veuillez remplir tous les champs du formulaire.');
            return;
        }
        
        // Here you would normally send data to the server
        // For demonstration, we'll just show a success message
        
        contactForm.innerHTML = `
            <div class="success-message">
                <p>Merci pour votre message, ${name}!</p>
                <p>Nous vous contacterons bientôt.</p>
            </div>
        `;
    });
}

// Add animation for statistics
function animateStats() {
    const stats = document.querySelectorAll('.number');
    
    stats.forEach(stat => {
        const targetValue = stat.textContent;
        const animationDuration = 2000; // ms
        
        let startTimestamp = null;
        const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / animationDuration, 1);
            
            // Parse the target value to handle different formats (numbers with units like km²)
            const match = targetValue.match(/^([\d.]+)(.*)$/);
            if (match) {
                const numericPart = parseFloat(match[1]);
                const unitPart = match[2];
                
                stat.textContent = Math.floor(progress * numericPart) + unitPart;
                
                if (progress < 1) {
                    window.requestAnimationFrame(step);
                } else {
                    stat.textContent = targetValue;
                }
            }
        };
        
        window.requestAnimationFrame(step);
    });
}

// Run animations when scrolled into view
const observerOptions = {
    root: null,
    rootMargin: '0px',
    threshold: 0.1
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting && entry.target.classList.contains('highlight-box')) {
            animateStats();
            observer.unobserve(entry.target);
        }
    });
}, observerOptions);

// Start observing stats element
const highlightBox = document.querySelector('.highlight-box');
if (highlightBox) {
    observer.observe(highlightBox);
}
