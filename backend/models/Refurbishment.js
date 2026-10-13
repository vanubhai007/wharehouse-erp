const mongoose = require('mongoose');
const fileSchema = require('./shared/fileSchema');

const refurbishmentSchema = new mongoose.Schema(
  {
    item: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true, index: true },
    workDescription: { type: String, required: true },
    assignedTo: { type: String, required: true }, // staff name or vendor name
    assignedUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    beforePhotos: [fileSchema],
    afterPhotos: [fileSchema],
    repairCost: { type: Number, default: 0, min: 0 },
    startDate: { type: Date, required: true },
    completionDate: { type: Date },
    conditionAfter: {
      type: String,
      enum: ['New', 'Good', 'Fair', 'Needs Repair', 'Damaged'],
    },
    status: { type: String, enum: ['Assigned', 'In Progress', 'Completed', 'Approved'], default: 'Assigned' },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedAt: { type: Date },
    notes: { type: String },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Refurbishment', refurbishmentSchema);
