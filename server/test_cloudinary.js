import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

async function testUpload() {
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            { 
                resource_type: "image", 
                folder: "gestro/classrooms",
                public_id: "teststream"
            },
            (error, result) => {
                if (error) reject(error);
                else resolve(result);
            }
        );
        fs.createReadStream('test.pdf').pipe(stream);
    });
}

testUpload().then(console.log).catch(console.error);
