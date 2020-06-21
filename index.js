require('dotenv').config();

const compression = require('compression');
const cors = require('cors');
const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');
const mongoose = require('mongoose');
const multer = require('multer');
const { Readable } = require('stream');

const app = express();

app.use(morgan('dev'));
app.use(helmet());
app.use(cors({ origin: ['http://localhost:3000'], methods: ['GET', 'POST'] }));
app.use(compression());

app.get('/:id', async (req, res, next) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    res.status(404).send({ success: false, message: 'Media not found' });
    return;
  }

  const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
    bucketName: 'images'
  });
  const cursor = bucket.find({ _id: mongoose.Types.ObjectId(req.params.id) });
  try {
    const files = await cursor.toArray();
    if (!files.length) {
      res.status(404).send({ success: false, message: 'Media not found' });
      return;
    }

    res.header('Content-Type', files[0].metadata.mimetype);
    res.header('Accept-Ranges', 'bytes');

    const downloadStream = bucket.openDownloadStream(files[0]._id);
    downloadStream.pipe(res);
  } catch (err) {
    next(err);
  }
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fields: 1, files: 1, parts: 2 }
});
app.post('/', upload.single('image'), (req, res, next) => {
  const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
    bucketName: 'images'
  });
  const readable = new Readable();
  const uploadStream = bucket.openUploadStream(req.file.originalname, {
    metadata: { mimetype: req.file.mimetype }
  });

  readable.push(req.file.buffer);
  readable.push(null);
  readable.pipe(uploadStream);

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
