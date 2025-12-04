import {v2 as cloudinary} from 'cloudinary';
import fs from 'fs';


cloudinary.config({ 
        cloud_name:process.env.COULDINARY_CLOUD_NAME, 
        api_key: process.env.CLOUDINARY_API_KEY, 
        api_secret: process.env.CLOUDINARY_API_SECRET // Click 'View API Keys' above to copy your API secret
    });

const uploadOnCloudinary= async (localFilePath)=>{
    try{
        if(!localFilePath) return null
        // Upload file to Cloudinary
        const response = await cloudinary.uploader.upload(localFilePath,{
            resource_type:"auto",
        })
        //file uploaded successfully
        console.log('File uploaded to Cloudinary successfully:', response.url);
        return response
    }catch(error){
        fs.unlinkSync(localFilePath)
        //remove the file from local storage if uploaded failed
        return null
    }
}

export {uploadOnCloudinary}