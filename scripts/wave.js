const bars = document.querySelectorAll(".loader div");

setInterval(() => {
    bars.forEach(bar => {
        const h = 20 + Math.random() * 80;
        bar.style.height = `${h}px`;
    });
}, 80);