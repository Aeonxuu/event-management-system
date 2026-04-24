import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const DEFAULT_MONGO_URI = "mongodb://localhost:27017/school-ems-mvp";
const MONGODB_URI = process.env.MONGODB_URI || DEFAULT_MONGO_URI;
const DEFAULT_PASSWORD = "demo123";

const userRoles = ["STUDENT_LEADER", "ADVISER", "DEAN", "FACILITIES", "OSA", "ADMIN"];

const OrganizationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    code: { type: String, required: true, unique: true },
    description: { type: String, default: "" },
  },
  { timestamps: true },
);

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    passwordHash: { type: String, required: true },
    role: { type: String, required: true, enum: userRoles },
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: "Organization" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

const VenueSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    location: { type: String, required: true, trim: true },
    capacity: { type: Number, required: true, min: 1 },
    isActive: { type: Boolean, default: true },
    notes: { type: String },
  },
  { timestamps: true },
);

VenueSchema.index({ name: 1, location: 1 }, { unique: true });

const EventSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    organizerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", required: true },
    venueId: { type: mongoose.Schema.Types.ObjectId, ref: "Venue" },
    status: {
      type: String,
      required: true,
      enum: ["DRAFT", "PENDING_ADVISER", "PENDING_DEAN", "PENDING_FACILITIES", "PENDING_OSA", "APPROVED", "REVISION_REQUIRED"],
      default: "DRAFT",
    },
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
    budget: { type: mongoose.Schema.Types.Decimal128, required: true },
    expectedAttendees: { type: Number, required: true, min: 1 },
    submittedAt: { type: Date },
    currentApproverRole: { type: String, enum: ["ADVISER", "DEAN", "FACILITIES", "OSA"] },
    lastActionBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    revisionNotes: { type: String, trim: true },
  },
  { timestamps: true },
);

const Organization = mongoose.models.Organization || mongoose.model("Organization", OrganizationSchema);
const User = mongoose.models.User || mongoose.model("User", UserSchema);
const Venue = mongoose.models.Venue || mongoose.model("Venue", VenueSchema);
const Event = mongoose.models.Event || mongoose.model("Event", EventSchema);

async function seed() {
  await mongoose.connect(MONGODB_URI, { dbName: "school-ems-mvp" });

  await Organization.deleteOne({
    $or: [{ code: "CSC" }, { name: "Computer Society Council" }],
  });

  const organizations = [
    { name: "CCMS DSC", code: "CCMS_DSC", description: "CCMS Developer Students Club" },
    { name: "MASTECH", code: "MASTECH", description: "Mathematics and Technology Organization" },
  ];

  for (const organization of organizations) {
    const existingOrganization = await Organization.findOne({
      $or: [{ code: organization.code }, { name: organization.name }],
    })
      .select("_id")
      .lean();

    if (existingOrganization) {
      continue;
    }

    await Organization.create(organization);
  }

  const ccmsOrg = await Organization.findOne({ code: "CCMS_DSC" }).select("_id");
  const mastechOrg = await Organization.findOne({ code: "MASTECH" }).select("_id");

  if (!ccmsOrg || !mastechOrg) {
    throw new Error("Required organizations are missing after seed step");
  }

  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 12);

  const users = [
    {
      name: "DSC Student Leader",
      email: "student.dsc@school.demo",
      role: "STUDENT_LEADER",
      organizationId: ccmsOrg._id,
    },
    {
      name: "MASTECH Student Leader",
      email: "student.mastech@school.demo",
      role: "STUDENT_LEADER",
      organizationId: mastechOrg._id,
    },
    { name: "Adviser Demo", email: "adviser@school.demo", role: "ADVISER", organizationId: ccmsOrg._id },
    { name: "Dean Demo", email: "dean@school.demo", role: "DEAN", organizationId: ccmsOrg._id },
    {
      name: "Facilities Demo",
      email: "facilities@school.demo",
      role: "FACILITIES",
      organizationId: ccmsOrg._id,
    },
    { name: "OSA Demo", email: "osa@school.demo", role: "OSA", organizationId: ccmsOrg._id },
    { name: "Admin Demo", email: "admin@school.demo", role: "ADMIN" },
  ];

  for (const user of users) {
    await User.findOneAndUpdate(
      { email: user.email },
      {
        name: user.name,
        email: user.email,
        role: user.role,
        organizationId: user.organizationId,
        passwordHash,
        isActive: true,
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
    );
  }

  const venues = [
    { name: "MSEUF Gymnasium", location: "Gymnasium", capacity: 700 },
    { name: "St. Bonaventure", location: "Main Campus", capacity: 200 },
    { name: "Student Lounge", location: "Main Campus", capacity: 100 },
    { name: "Twin Court", location: "Beside Gymnasium", capacity: 400 },
    { name: "Library", location: "Main Campus", capacity: 70 },
    { name: "Seminar Hall", location: "Library Bldg.", capacity: 60 },
    { name: "CCMS Lounge", location: "CCMS Department", capacity: 100 },
    { name: "AEC Little Theater", location: "CAS Department", capacity: 200 },
  ];

  for (const venue of venues) {
    const existingVenue = await Venue.findOne({ name: venue.name }).select("_id").lean();
    if (existingVenue) {
      continue;
    }

    await Venue.create({
      ...venue,
      isActive: true,
    });
  }

  const studentLeader = await User.findOneAndUpdate(
    { email: "student.dsc@school.demo" },
    { organizationId: ccmsOrg._id },
    { returnDocument: "after" },
  )
    .select("_id organizationId")
    .lean();

  const seededVenues = await Venue.find({ name: { $in: ["MSEUF Gymnasium", "St. Bonaventure", "Student Lounge"] } })
    .select("_id name")
    .lean();

  const venueByName = new Map(seededVenues.map((venue) => [venue.name, venue._id]));

  const baseDate = new Date();
  const demoEvents = [
    {
      title: "Tech Week Kickoff Planning",
      description: "Draft proposal for the organization kickoff event including opening program and logistics.",
      venueName: "Student Lounge",
      status: "DRAFT",
      dayOffset: 12,
      durationHours: 2,
      budget: "12000",
      expectedAttendees: 90,
    },
    {
      title: "Programming Workshop Series",
      description: "Draft event for a hands-on workshop series focused on web development fundamentals.",
      venueName: "St. Bonaventure",
      status: "DRAFT",
      dayOffset: 18,
      durationHours: 3,
      budget: "18000",
      expectedAttendees: 130,
    },
    {
      title: "Campus Innovation Expo",
      description: "Approved showcase event for student project demonstrations and innovation booths.",
      venueName: "MSEUF Gymnasium",
      status: "APPROVED",
      dayOffset: 28,
      durationHours: 5,
      budget: "45000",
      expectedAttendees: 350,
    },
  ];

  if (studentLeader) {
    for (const event of demoEvents) {
      const startAt = new Date(baseDate.getTime() + event.dayOffset * 24 * 60 * 60 * 1000);
      startAt.setHours(9, 0, 0, 0);
      const endAt = new Date(startAt.getTime() + event.durationHours * 60 * 60 * 1000);

      const venueId = venueByName.get(event.venueName);

      await Event.findOneAndUpdate(
        { title: event.title, organizerId: studentLeader._id },
        {
          title: event.title,
          description: event.description,
          organizerId: studentLeader._id,
          organizationId: studentLeader.organizationId ?? ccmsOrg._id,
          venueId,
          status: event.status,
          startAt,
          endAt,
          budget: event.budget,
          expectedAttendees: event.expectedAttendees,
          submittedAt: event.status === "APPROVED" ? new Date(startAt.getTime() - 5 * 24 * 60 * 60 * 1000) : undefined,
        },
        { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
      );
    }
  }

  console.log("Seed complete.");
  console.log("Default password for all demo users:", DEFAULT_PASSWORD);
  console.table(
    users.map((u) => ({
      role: u.role,
      email: u.email,
    })),
  );

  await mongoose.disconnect();
}

seed().catch(async (error) => {
  console.error("Seed failed:", error);
  await mongoose.disconnect();
  process.exit(1);
});
