const { ObjectId } = require("mongodb");
const { sales, OrderCollection, productCollection, salesReturns } = require("../../index.js");

const getAllSales = async (req, res) => {
  try {

    const search = Number(req.query.search);

    let invoiceID;
    if (search > 0) {
      invoiceID = {$or: [
        { invoiceID: search }
      ]}
    }
      const page = Number(req.query.page) || 1
      const limit = Number(req.query.limit) || 5

      const skip = (page - 1) * limit


    const allSales = await sales.aggregate([
      {
        $match: {
          ...invoiceID
        }
      },
      {
        $facet: {
          totalCount: [
            {
              $group: {
                _id: null,
                count: { $sum: 1 }
              }
            },
            {
              $project: {
                _id: 0,
                count: 1
              }
            }
          ],
          postsData: [
            {
              $sort: { _id: -1 } // Sorting in ascending order of serialNumber
            },
            {
              $skip: skip
            },
            {
              $limit: limit
            }
          ]
        }
      },
      {
        $project: {
          totalCount: { $arrayElemAt: ["$totalCount", 0] },
          postsData: 1
        }
      }
    ]).sort({ _id: -1 }).toArray();;
      // Send a response back to the client
    res.status(200).json(allSales );
  } catch (err) {
    console.error("Error Create User:", err);
    res.status(500).json({ error: "An error occurred" });
  }
};


const getLastSale = async (req, res) => {
  const cursor = sales.find({}).sort({ _id: -1 }).limit(1);

  const orders = await cursor.toArray();
  res.send(orders);
};

const createOnlineSale = async (req, res) => {
  const id = req.params.id;

  const order = await OrderCollection.findOne({ _id: new ObjectId(id) });


  await sales.insertOne(order);
  // Send a response back to the client
  res.json({ message: "Data received successfully" });
};
const createPosSale = async (req, res) => {
  try {
    const order = req.body

    const sale = await sales.insertOne(order);
    // Send a response back to the client
    res.json(sale);
  } catch (error) {
    console.log(error)
    res.json(error);

  }
};

const updateSale = (req, res) => {
  const id = req.params.id; // Extract the document ID from the request parameters
  const updateData = req.body; // Extract the updated data from the request body

  // Update the document in the collection
  sales
    .updateOne({ _id: new ObjectId(id) }, { $set: updateData })
    .then(() => {
      res.sendStatus(200); // Send a success status code if the update was successful
    })
    .catch((error) => {
      console.error("Error updating document:", error);
      res.status(500).send("Error updating document");
    });
};

const getASale = (req, res) => {
  const id = req.params.id; // Extract the document ID from the request parameters

  // Find the document in the collection
  sales
    .findOne({ _id: new ObjectId(id) })
    .then((document) => {
      if (document) {
        res.json(document); // Send the found document as the response
      }
      // else {
      //   res.sendStatus(404); // Send a 404 status code if the document was not found
      // }
    })
    .catch((error) => {
      console.error("Error finding document:", error);
      res.status(500).send("Error finding document");
    });
};



const createReturnSale = async (req, res) => {
  const sale = req.body
  
  await salesReturns.insertOne(sale)
  
  res.status(200).json("Sale Return Success")
  
}

const returnSale = async (req, res) => {
  const saleId = req.params.id;


  await sales.deleteOne({ _id: new ObjectId(saleId) })

  res.sendStatus(200);

}

const getAllReturnSale = async (req, res) => {

 const returnSale =  await salesReturns.find({}).sort({_id: -1}).toArray()

  res.status(200).json(returnSale)

}

const getCustomerBuy = async (req, res) => {
  const page = Number(req.query.page) || 1
  const limit = Number(req.query.limit) || 5
  const id = req.query.id || 0
  const skip = (page - 1) * limit

  try {
    let customer = await sales.aggregate([
      {
        $match: {
          $or: [
            { customerId: id},
          ]
        }
      },
      {
        $facet: {
          totalCount: [
            {
              $group: {
                _id: null,
                count: { $sum: 1 }
              }
            },
            {
              $project: {
                _id: 0,
                count: 1
              }
            }
          ],
          postsData: [
            {
              $sort: { _id: -1 } // Sorting in ascending order of serialNumber
            },
            {
              $skip: skip
            },
            {
              $limit: limit
            }
          ]
        }
      },
      {
        $project: {
          totalCount: { $arrayElemAt: ["$totalCount", 0] },
          postsData: 1
        }
      }
    ]).sort({ _id: -1 }).toArray();

    res.status(200).json(customer);
  } catch (err) {
    console.error("Error Create User:", err);
    res.status(500).json({ error: "An error occurred" });
  }
};


module.exports = {
  getAllSales,
  updateSale,
  getASale,
  createOnlineSale,
  createPosSale,
  returnSale,
  createReturnSale,
  getAllReturnSale,
  getLastSale,
  getCustomerBuy
};
