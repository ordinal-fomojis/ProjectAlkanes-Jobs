import { Document } from "mongodb"
import { CollectionName } from "./collections.js"
import { database } from "./database.js"

const MINTABLE_ALKANES = {
  factories: ['4:797'],
  ids: ['2:0']
}

export async function syncPendingMints(match: Document | null) {
  await database.alkaneToken.aggregate([
    ...(match == null ? [] : [{ $match: match }]),
    { 
      $lookup: {
        from: CollectionName.MempoolTransaction,
        localField: "alkaneId",
        foreignField: "mintId",
        as: "pendingMints"
      }
    },
    { $addFields: {
      pendingMints: { $size: "$pendingMints" },
      mintable: {
        $or: [
          { $in: ["$alkaneId", MINTABLE_ALKANES.ids] },
          { $in: ["$clonedFrom", MINTABLE_ALKANES.factories] }
        ]
      }
    } },
    { $merge: { into: CollectionName.AlkaneToken, whenMatched: 'replace', whenNotMatched: 'insert' } }
  ]).toArray()
}
