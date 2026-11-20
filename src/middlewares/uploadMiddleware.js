import multer from 'multer';
import cloudinary from '../config/cloudinary.js';
import streamifier from 'streamifier';

// Configura o multer para usar a memória RAM (sem salvar na pasta local do Render)
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Upload do chat: mesmo esquema, mas com limite de 20 MB (o front também limita em 20 MB)
const uploadChat = multer({ storage: storage, limits: { fileSize: 20 * 1024 * 1024 } });

// Envia o buffer para o Cloudinary e retorna a URL segura.
// resourceType: 'image' (padrão, como antes) | 'auto' (aceita áudio, vídeo e PDF — usado no chat)
const uploadToCloudinary = (fileBuffer, resourceType = 'image') => {
    return new Promise((resolve, reject) => {
        let stream = cloudinary.uploader.upload_stream(
            { folder: 'civvo_uploads', resource_type: resourceType },
            (error, result) => {
                if (result) {
                    resolve(result.secure_url);
                } else {
                    reject(error);
                }
            }
        );
        streamifier.createReadStream(fileBuffer).pipe(stream);
    });
};

export { upload, uploadChat, uploadToCloudinary };
