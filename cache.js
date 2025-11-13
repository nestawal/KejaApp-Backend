const idCache = (cacheData) =>{
    const Data = {
        id: cacheData.id,
        email: cacheData.email,
        posts: [cacheData.posts],
        carts: [cacheData.carts]
    }

    return Data
}

module.exports = {idCache};