  // --- SUB-HEADER RESIZABLE COLUMNS DRAGGING ---
  export function initResizableColumns() {
    const dividerAlbum = document.getElementById("dividerAlbum");
    const dividerTime = document.getElementById("dividerTime");

    if (dividerAlbum) {
      const handleStart = (clientX) => {
        const startX = clientX;
        const startWidth = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--col-title-width') || '250');
        
        function onMouseMove(moveEvent) {
          const deltaX = moveEvent.clientX - startX;
          let newTitleWidth = startWidth + deltaX;
          newTitleWidth = Math.max(150, newTitleWidth); // absolute min title width
          
          // Read live total width to prevent dragging-back pulling
          const liveTotalWidth = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--col-total-width') || '450');
          
          if (newTitleWidth > liveTotalWidth - 150) {
            // Push dividerTime to the right to maintain min 150px album width
            let newTotalWidth = newTitleWidth + 150;
            const containerWidth = document.querySelector('.ex-right')?.clientWidth || 500;
            const maxTotalWidth = containerWidth - 260;
            if (newTotalWidth > maxTotalWidth) {
              newTotalWidth = maxTotalWidth;
              newTitleWidth = newTotalWidth - 150; // cap title width to match container limit
            }
            document.documentElement.style.setProperty('--col-total-width', `${newTotalWidth}px`);
          }
          document.documentElement.style.setProperty('--col-title-width', `${newTitleWidth}px`);
        }
        
        function onMouseUp() {
          window.removeEventListener("mousemove", onMouseMove);
          window.removeEventListener("mouseup", onMouseUp);
        }
        
        window.addEventListener("mousemove", onMouseMove);
        window.addEventListener("mouseup", onMouseUp);
      };

      dividerAlbum.addEventListener("mousedown", (e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        handleStart(e.clientX);
      });

      dividerAlbum.addEventListener("touchstart", (e) => {
        handleStart(e.touches[0].clientX);
      }, { passive: true });
    }

    if (dividerTime) {
      const handleStart = (clientX) => {
        const startX = clientX;
        const startWidth = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--col-total-width') || '450');
        
        function onMouseMove(moveEvent) {
          const deltaX = moveEvent.clientX - startX;
          let newTotalWidth = startWidth + deltaX;
          
          const containerWidth = document.querySelector('.ex-right')?.clientWidth || 500;
          const maxTotalWidth = containerWidth - 260;
          newTotalWidth = Math.min(maxTotalWidth, newTotalWidth);
          
          // Read live title width to prevent dragging-back pulling
          const liveTitleWidth = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--col-title-width') || '250');
          
          if (newTotalWidth < liveTitleWidth + 150) {
            // Push dividerAlbum to the left to maintain min 150px album width
            let newTitleWidth = newTotalWidth - 150;
            if (newTitleWidth < 150) {
              newTitleWidth = 150;
              newTotalWidth = newTitleWidth + 150; // cap total width to match min limits
            }
            document.documentElement.style.setProperty('--col-title-width', `${newTitleWidth}px`);
          }
          document.documentElement.style.setProperty('--col-total-width', `${newTotalWidth}px`);
        }
        
        function onMouseUp() {
          window.removeEventListener("mousemove", onMouseMove);
          window.removeEventListener("mouseup", onMouseUp);
        }
        
        window.addEventListener("mousemove", onMouseMove);
        window.addEventListener("mouseup", onMouseUp);
      };

      dividerTime.addEventListener("mousedown", (e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        handleStart(e.clientX);
      });

      dividerTime.addEventListener("touchstart", (e) => {
        handleStart(e.touches[0].clientX);
      }, { passive: true });
    }
  }

