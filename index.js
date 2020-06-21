require('dotenv').config();
const compression = require('compression');
const cors = require('cors');
const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');
const mongoose = require('mongoose');
const multer = require('multer');
const stream = require('stream');

const app = express();

app.use(morgan('dev'));
app.use(helmet());
app.use(cors({ origin: ['http://localhost:3000'], methods: ['GET', 'POST'] }));
app.use(compression());

app.get('/:id', (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    res.status(404).send({ success: false, message: 'Media not found' });
  }

  const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
    bucketName: 'tracks'
  });
  const downloadStream = bucket.openDownloadStream(
    mongoose.Types.ObjectId(req.params.id)
  );

  res.header('Content-Type', 'image/jpeg');
  res.header('Accept-Ranges', 'bytes');

  downloadStream.on('error', () => {
    res.status(404).send({ success: false, message: 'Media not found' });
  });

  downloadStream.on('data', chunk => {
    res.write(chunk);
  });

  downloadStream.on('end', () => {
    res.end();
  });
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fields: 1, files: 1, parts: 2 }
});
app.post('/', upload.single('track'), (req, res, next) => {
  const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
    bucketName: 'tracks'
  });
  const readableStream = new stream.Readable();
  const uploadStream = bucket.openUploadStream(req.body.name);

  readableStream.push(req.file.buffer);
  readableStream.push(null);
  readableStream.pipe(uploadStream);

  uploadStream.on('error', err => {
    next(err);
    return;
  });

  uploadStream.on('finish', () => {
    res.send({ success: true, data: uploadStream.id });
  });
});

// eslint-disable-next-line no-unused-vars
app.use(function(err, req, res, next) {
  res.status(500).send({ success: false, message: err.message });
});

(async () => {
  const MONGODB_URI =
    process.env.MONGODB_URI || 'mongodb://localhost:27017/image-uploader-test';
  await mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });
  console.log('Connected to MongoDB');

  const PORT = parseInt(process.env.PORT, 10) || 3900;
  app.listen(PORT, () => {
    console.log('Listening on port: ' + PORT);
  });
})();
