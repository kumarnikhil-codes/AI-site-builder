import axios from 'axios';


const api = axios.create({
    baseURL: import.meta.env.VITE_BASEURL || 'http://localhost:3000/api/user/project',
    withCredentials: true
})

export default api