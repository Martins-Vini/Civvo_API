import { v2 as cloudinary } from 'cloudinary';

/* O Cloudinary já é configurado para as publicações; aqui só reaproveitamos essa configuração. */
export const cloudinaryConfigurado = () => !!cloudinary.config().cloud_name;

export function enviarImagem(buffer, pasta = 'civvo') {
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            { folder: pasta, resource_type: 'image' },
            (erro, resultado) => (erro ? reject(erro) : resolve(resultado.secure_url))
        );
        stream.end(buffer);
    });
}