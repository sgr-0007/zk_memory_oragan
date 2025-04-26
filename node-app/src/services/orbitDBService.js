import { create } from "kubo-rpc-client";
import OrbitDB from "orbit-db";
import { PostgresService } from './postgresService.js';

export class OrbitDBService {
  constructor() {
    this.db = null;
    this.userdb = null;
    this.postgresService = new PostgresService();
  }

  async init() {
    try {
      console.log("Connecting to IPFS...");
      this.ipfs = create({
        url: "http://3.86.110.183:5001", 
        Address: {
          API: '/ip4/3.86.110.183/tcp/5001',
          Gateway: '/ip4/3.86.110.183/tcp/8080'
        },
        config: {
          Pubsub: {
            Enabled: true
          }
        }
      });

      console.log("Initializing OrbitDB...");
      this.orbitdb = await OrbitDB.createInstance(this.ipfs, {
        directory: "./orbitdb_data",
      });

      this.db = await this.orbitdb.docstore("dmo-docstore", {
        accessController: { write: ["*"] },
      });

      await this.db.load();


      this.userdb = await this.orbitdb.docstore("dmo-userstore", {
        accessController: { write: ["*"] },
      });

      await this.userdb.load();

      await this.postgresService.init();
      console.log("OrbitDB initialized. DB address:", this.db.address.toString());
      console.log("OrbitDB initialized. User address:", this.userdb.address.toString());
    } catch (error) {
      console.error("Failed to initialize OrbitDB:", error);
      process.exit(1);
    }
  }

  async createUser(user) {
    try {
      console.log(`Storing user in OrbitDB: ${user._id}`);
      const cid = await this.userdb.put(user);
      return cid;
    } catch (error) {
      console.error("Error creating user:", error);
      throw new Error("Failed to create user");
    }
  }


  async createDoc(doc) {
    try {
      console.log(`Storing document in OrbitDB: ${doc._id}`);
      const cid = await this.db.put(doc);
      console.log(`Caching document in PostgreSQL: ${doc._id}`);
      console.log(`cid ${cid}`);
      await this.postgresService.set(doc._id, doc, cid, doc.uid);
      return cid;
    } catch (error) {
      console.error("Error creating document:", error);
      throw new Error("Failed to create document");
    }
  }

  async getDocById(uid) {
    console.log(`Fetching document: ${uid}`);

    let cachedDoc = await this.postgresService.get(uid);
    if (cachedDoc) {
      console.log(`Returning from cache: ${uid}`);
      return cachedDoc;
    }

    const result = this.db.query(doc => doc.uid === uid); // Filter by uid
    console.log(`Not found in cache, fetching from OrbitDB: ${uid}`);
    // 3️⃣ Store all documents in PostgreSQL cache
    for (let doc of result) {
      const cid = await this.db.put(doc); // Get CID for each document
      await this.postgresService.set(doc._id, doc, cid, uid);
    }

    console.log(`Cached ${result.length} documents from OrbitDB for UID: ${uid}`);
    return result;
  }

  async getAllDocs() {
    console.log("Checking cache for all documents...");
    const cachedDocs = await this.postgresService.getAll();

    if (cachedDocs.length) {
      console.log("Returning all documents from cache.");
      return cachedDocs;
    }

    console.log("Cache is empty, fetching from OrbitDB...");
    const docs = await this.db.query(() => true);

    for (let doc of docs) {
      const cid = await this.db.put(doc); // Get the cid for each document
      await this.postgresService.set(doc._id, doc, cid, doc.uid);
    }

    console.log("Cached all documents from OrbitDB.");
    return docs;
  }

  async updateDoc(doc) {
    try {
      console.log(`Updating document in OrbitDB: ${doc._id}`);
      const cid = await this.db.put(doc);

      console.log(`Updating document in PostgreSQL cache: ${doc._id}`);
      await this.postgresService.set(doc._id, doc, cid, doc.uid);

      return doc;
    } catch (error) {
      console.error(`Error updating document ${doc._id}:`, error);
      throw new Error("Failed to update document");
    }
  }

  async deleteUser(id) {
    try {
      console.log(`Deleting user from OrbitDB: ${id}`);
      await this.userdb.del(id);
      console.log(`Removing user from PostgreSQL cache: ${id}`);
      await this.postgresService.del(id);
      
      // Delete all documents associated with the user
      const docs = await this.db.query(doc => doc.uid === id);
      for (let doc of docs) {
        await this.db.del(doc._id);
        console.log(`Deleted document: ${doc._id}`);
      }
      console.log(`User ${id} and associated documents deleted successfully`);
    } catch (error) {
      console.error(`Error deleting user ${id}:`, error);
      throw new Error("Failed to delete user");
    }
  }

  async deleteDoc(id) {
    try {
      console.log(`Deleting document from OrbitDB: ${id}`);
      await this.db.del(id);

      console.log(`Removing document from PostgreSQL cache: ${id}`);
      await this.postgresService.del(id);
    } catch (error) {
      console.error(`Error deleting document ${id}:`, error);
      throw new Error("Failed to delete document");
    }
  }

  async getUserById(_id) {
    try {
      const user = await this.userdb.get(_id);
      console.log(user);
      return user;
    } catch (error) {
      console.error("Error getting user:", error);
      throw new Error("Failed to get user");
    }
  }
} 