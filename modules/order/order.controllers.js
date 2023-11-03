const { OrderCollection, defaultSize, customProductions, productCollection, productCategory  } = require("../../index.js");
const jwt = require("jsonwebtoken");
const { ObjectId } = require("mongodb");
// const { Promise } = require("mongoose");
var Promise = require("promise");

const getAllOrder = async (req, res) => {
  const { type } = req.query;
  try {
    const cursor = OrderCollection.find({
      $or: [
        { status: "WaitingReview" },
        { status: "OnHold" },
        { status: "making" },
        { status: "ReadyToShip" },
        { status: "Shipped" },
      ],
    });

    const orders = await cursor.sort({ _id: -1 }).toArray();

    if (type === 'test') {
      return res.json(orders);
    }

    for (const order of orders) {
      const customMade = order?.cart[1]?.customMade;

      if (customMade) {
        let production = [];

        for (const item of customMade) {
          if (item?.productionId) {
            const productionStatus = await customProductions.findOne({
              _id: new ObjectId(item?.productionId),
            });

            production.push(productionStatus);
          }
        }


        const successStatus = production.filter(
          (item) => item?.status === 'success'
        );

        const makingStatus = production.filter(
          (item) => item?.status === 'making' || item?.status === 'pending' || item?.status === 'reject'
        );


        if (customMade.length === successStatus.length) {
          await OrderCollection.updateOne(
            { _id: new ObjectId(order._id) },
            { $set: { status: 'ReadyToShip' } }
          );
        }

        if (customMade.length === makingStatus.length) {
          await OrderCollection.updateOne(
            { _id: new ObjectId(order._id) },
            { $set: { status: 'making' } }
          );
        }

        if (customMade.length > makingStatus.length && customMade.length > successStatus.length) {
          await OrderCollection.updateOne(
            { _id: new ObjectId(order._id) },
            { $set: { status: 'WaitingReview' } }
          );
        }

      }

    }

    res.json(orders);
  } catch (error) {
    console.log('error', 'order fetch failed');
    res.status(403).send('something went wrong!')
    console.log(error)
    // res.json(error)
  }
};

const getAllDefaultSize = async (req, res) => {
  const cursor = defaultSize.find({});

  const sizes = await cursor.sort({ _id: -1 }).toArray();
  res.send(sizes);
};

const getReadyToShipProduct = async (req, res) => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 1;
  const search = req.query.search || 0;
  let skip = 0;
  skip = (page - 1) * limit;

  let products = await OrderCollection.aggregate([
    {
      $match: {
        $or: [
          { status: { $regex: "ReadyToShip" } } // Matching orders with status "ReadyToShip"
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
            $sort: { _id: -1 } // Sorting orders by _id in descending order
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
  ]).toArray();

  if (products.length) {
    // Define the following variables
    let readyMadeProducts = [];
    let customMadeProducts = [];

    // Check if the products structure is as expected
    if (Array.isArray(products) && products.length > 0 && products[0]?.postsData) {
      products[0].postsData.forEach((product) => {
        if (product?.cart[0]?.readyMade) {
          readyMadeProducts.push(...product.cart[0].readyMade);
        }
        if (product?.cart[1]?.customMade) {
          customMadeProducts.push(...product.cart[1].customMade);
        }
      });
    } else {
      console.log("Handle the case when products or their structure is not as expected");
    }

    // Fetch details for readyMade products and category
    // await Promise.all(
      
    //   );
      
      const readyMade = [];
      await Promise.all(readyMadeProducts.map(async (item) => {
        const product = await productCollection.findOne({ _id: new ObjectId(item.productId) });
        const category = await productCategory.findOne({ _id: new ObjectId(product?.category) });
        if (product && category) {
          readyMade.push({ ...product, productSize: item.productSize, category: category.category });
        }
      }));


    // Combine readyMade and customMade products into a single array
    const allProducts = [...readyMade, ...customMadeProducts];

    console.log(customMadeProducts)

    // Create a response object with orders and products
    const response = { orders: products[0], products: allProducts };

    res.status(200).json(response);
  } else {
    res.status(200).json({
      success: false
    });
  }
};

const updateOrder = (req, res) => {
  const id = req.params.id; // Extract the document ID from the request parameters
  const updateData = req.body; // Extract the updated data from the request body

  // Update the document in the collection
  OrderCollection.updateOne({ _id: new ObjectId(id) }, { $set: updateData })
    .then(() => {
      res.sendStatus(200); // Send a success status code if the update was successful
    })
    .catch((error) => {
      console.error("Error updating document:", error);
      res.status(500).send("Error updating document");
    });
};

const createOrder = async (req, res) => {

  try {
    const receivedData = req.body;


    const lastOrder = await OrderCollection.find({}).sort({ _id: -1 }).limit(1).toArray();
    console.log(receivedData.invoiceID, lastOrder[0]?.invoiceID + 1)

    receivedData.invoiceID = lastOrder[0]?.invoiceID + 1

    for (const product of receivedData?.cart[0]?.readyMade) {
      console.log(product)
      await productCollection.updateOne(
        { _id: new ObjectId(product.productId) },
        { $inc: { [`size.${product.productSize}`]: -1 } }
      );
    }

    // console.log(receivedData);
    const order = await OrderCollection.insertOne(receivedData);
    console.log(order);
    // return res.send('just testing')
    // Send a response back to the client
    res.status(200).json(order);
  } catch (error) {
    console.log(error)
    // Handle errors and send an error response if needed
    res.status(500).json({ error: 'An error occurred' });
  }

};



const getAOrder = (req, res) => {
  const id = req.params.id; // Extract the document ID from the request parameters

  // Find the document in the collection
  OrderCollection.findOne({ _id: new ObjectId(id) })
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

const deleteAOrderById = (req, res) => {
  const id = req.params.id; // Extract the document ID from the request parameters

  // Find the document in the collection
  OrderCollection.deleteOne({ _id: new ObjectId(id) })
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
const updateDeliveryStatus = (req, res) => {
  try {
    const id = req.params.id;
    const status = req.body.status;

    // Find the document in the collectio
    // Update a single document
    OrderCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { status: status } }
    );
    res.status(200).send("Updated");
  } catch (error) {
    console.log(error)
    res.status(204).send(error);
  }
};

const updateProductionId = async (req, res) => {
  try {
    const id = req.params.id;
    const productionId = req.body.productionId;
    const index = req.body.index;

    // const dataPath = cart[1].customMade[index].productionId

    const updateProduction = OrderCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { [`cart.1.customMade.${index}.productionId`]: productionId } },
      { new: true }
    );
    res.status(200).send(updateProduction);
  } catch (error) {
    console.log(error)
    res.status(204).send(error);
  }
}

const getLastOrder = async (req, res) => {
  try {
    const cursor = OrderCollection.find({}).sort({ _id: -1 }).limit(1);

    const orders = await cursor.toArray();
    res.send(orders);
  } catch (error) {
    console.log(error)
    res.status(204).send(error);
  }
};


const testEndpoint = async (req, res) => {
  // OrderCollection
  const pipeline = [
    {
      $unwind: '$cart'
    },
    {
      $unwind: '$cart.customMade'
    },
    {
      $lookup: {
        from: 'customProductions',
        localField: 'cart.customMade.productionId',
        foreignField: '_id',
        as: 'customProductions'
      }
    },
    {
      $match: {
        'customProductions.status': 'success'
      }
    },
    {
      $group: {
        _id: '$_id'
      }
    }
  ];

  const ordersToUpdate = await OrderCollection.aggregate(pipeline).toArray();

  res.json(ordersToUpdate)

}

module.exports = {
  testEndpoint,
  getAllOrder,
  updateOrder,
  createOrder,
  getAOrder,
  deleteAOrderById,
  updateDeliveryStatus,
  getLastOrder,
  updateProductionId,
  getAllDefaultSize,
  getReadyToShipProduct
};
