require('dotenv').config();
const compression = require('compression');
const cors = require('cors');
const express = require('express');
const helmet = require('helmet');
const mongoose = require('mongoose');
const multer = require('multer');
const { Readable } = require('stream');

const app = express();

app.use(express.json());
app.use(cors());

const MONGODB_URI =
  process.env.MONGODB_URI || 'mongodb://localhost/image-uploader-test';

let db;
mongoose
  .connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  })
  .then(res => {
    db = res.connection.db;
    console.log('Connected to MongoDB');
  });

app.get('/:id', (req, res) => {
  let id;
  try {
    id = new mongoose.mongo.ObjectID(req.params.id);
  } catch (ex) {
    res.status(404).send('Not found');
  }
  res.set('content-type', 'audio/mp3');
  res.set('accept-ranges', 'bytes');

  const bucket = new mongoose.mongo.GridFSBucket(db, { bucketName: 'tracks' });
  const downloadStream = bucket.openDownloadStream(id);

  downloadStream.on('data', chunk => {
    res.write(chunk);
  });

  downloadStream.on('error', () => {
    res.sendStatus(404);
  });

  downloadStream.on('end', () => {
    res.end();
  });
});

app.post('/', (req, res) => {
  const storage = multer.memoryStorage();
  const upload = multer({
    storage,
    limits: { fields: 1, files: 1, parts: 2 }
  });
  upload.single('track')(req, res, err => {
    if (err) {
      console.log(err);
      return res.status(400).send('Upload request validation failed');
    }

    if (!req.body.name)
      return res.status(400).send('No track name in request body');

    const bucket = new mongoose.mongo.GridFSBucket(db, {
      bucketName: 'tracks'
    });
    const readableTrackStream = new Readable();
    readableTrackStream.push(req.file.buffer);
    readableTrackStream.push(null);

    const uploadStream = bucket.openUploadStream(req.body.name);
    readableTrackStream.pipe(uploadStream);

    uploadStream.on('error', () => {
      res.status(500).json({ message: 'Error uploading file' });
    });

    uploadStream.on('finish', () => {
      res.json({ message: 'File uploaded successfully ' + uploadStream.id });
    });
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('Listening on port', PORT);
});
