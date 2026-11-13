import multer from 'multer';
import cloudinary from '../config/cloudinary.js';
import streamifier from 'streamifier';

// Configura o multer para usar a memória RAM (sem salvar na pasta local do Render)
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Função auxiliar que envia o buffer para o Cloudinary e retorna a URL segura
const uploadToCloudinary = (fileBuffer) => {
    return new Promise((resolve, reject) => {
        let stream = cloudinary.uploader.upload_stream(
            { folder: 'civvo_uploads' }, // Nome da pasta que será criada no seu Cloudinary
            (error, result) => {
                if (result) {
                    resolve(result.secure_url); // Retorna a URL pública HTTPS da imagem
                } else {
                    reject(error);
                }
            }
        );
        streamifier.createReadStream(fileBuffer).pipe(stream);
    });
};

export { upload, uploadToCloudinary };