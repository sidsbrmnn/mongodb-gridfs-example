require('dotenv').config();
const cors = require('cors');
const crypto = require('crypto');
const express = require('express');
const Grid = require('gridfs-stream');
const mongoose = require('mongoose');
const multer = require('multer');
const GridFsStorage = require('multer-gridfs-storage');

const app = express();

app.use(express.json());
app.use(cors());

const MONGODB_URI =
  process.env.MONGODB_URI || 'mongodb://localhost/image-uploader-test';

const conn = mongoose.createConnection(MONGODB_URI);
mongoose.connect(MONGODB_URI, { useNewUrlParser: true });

let gfs;
conn.on('open', () => {
  gfs = Grid(conn.db, mongoose.mongo);
  gfs.collection('uploads');
  console.log('Connected to MongoDB');
});

const storage = new GridFsStorage({
  url: MONGODB_URI,
  file: (req, file) =>
    new Promise((resolve, reject) => {
      crypto.randomBytes(16, (err, buf) => {
        if (err) return reject(err);

        const filename = file.originalname;
        const fileinfo = {
          filename,
          bucketName: 'uploads'
        };

        resolve(fileinfo);
      });
    })
});

const upload = multer({ storage });

app.post('/', upload.single('img'), (req, res) => {
  res.send(req.files);
});

app.get('/:filename', (req, res) => {
  gfs.files.findOne({ filename: req.params.filename }, (err, file) => {
    if (!file || file.length === 0)
      return res.status(404).send('No file exists');

    if (file.contentType === 'image/jpeg' || file.contentType === 'image/png') {
      const readstream = gfs.createReadStream(file.filename);

      readstream.pipe(res);
    } else {
      res.status(404).send('Not an image');
    }
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('Listening on port', PORT);
});
