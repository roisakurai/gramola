const fs = require('fs');
const path = require('path');
const musicMetadata = require('music-metadata');

const songsDir = path.join(__dirname, 'frontend', 'assets', 'songs');
const coversDir = path.join(__dirname, 'frontend', 'assets', 'covers');

if (!fs.existsSync(coversDir)) {
  fs.mkdirSync(coversDir, { recursive: true });
}

async function scan() {
  try {
    const files = fs.readdirSync(songsDir).filter(f => f.endsWith('.mp3'));
    console.log(`Found ${files.length} mp3 files.`);
    
    const songs = [];
    let processed = 0;
    
    for (const file of files) {
      const filePath = path.join(songsDir, file);
      let title = '';
      let artist = 'Unknown Artist';
      let album = 'Unknown Album';
      let duration = 0;
      let coverPath = null;
      
      try {
        const metadata = await musicMetadata.parseFile(filePath);
        const { common, format } = metadata;
        
        duration = format.duration || 0;
        title = common.title || '';
        artist = common.artist || 'Unknown Artist';
        album = common.album || 'Unknown Album';
        
        if (common.picture && common.picture.length > 0) {
          const pic = common.picture[0];
          // Get correct extension
          let ext = 'jpg';
          if (pic.format === 'image/png') ext = 'png';
          else if (pic.format === 'image/gif') ext = 'gif';
          
          const safeName = file.replace(/[^a-zA-Z0-9]/g, '_');
          const coverFilename = `${safeName}.${ext}`;
          const fullCoverPath = path.join(coversDir, coverFilename);
          fs.writeFileSync(fullCoverPath, pic.data);
          coverPath = `assets/covers/${coverFilename}`;
        }
      } catch (err) {
        console.error(`Error parsing ${file}:`, err.message);
      }
      
      // Fallback if title is empty
      if (!title) {
        title = file.replace(/_spotdown\.org\.mp3$/i, '').replace(/\.mp3$/i, '').replace(/_/g, ' ').trim();
      }
      
      songs.push({
        file,
        title,
        artist,
        album,
        duration,
        cover: coverPath || 'assets/albums/blonde-frank ocean.jpg'
      });
      
      processed++;
      if (processed % 20 === 0) {
        console.log(`Processed ${processed}/${files.length}...`);
      }
    }
    
    fs.writeFileSync(
      path.join(__dirname, 'frontend', 'songs.json'),
      JSON.stringify(songs, null, 2)
    );
    console.log(`Saved ${songs.length} songs to songs.json`);
  } catch (err) {
    console.error('Scanning failed:', err);
  }
}

scan();
