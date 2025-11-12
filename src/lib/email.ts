import { prisma } from './db';

interface InvitationEmailData {
  tripName: string;
  invitedBy: string;
  tripId: string;
}

/**
 * Send trip invitation email to a user
 * This is a placeholder that creates a notification in the database
 * In production, integrate with an actual email service (SendGrid, AWS SES, etc.)
 */
export async function sendInvitationEmail(
  email: string,
  data: InvitationEmailData
): Promise<void> {
  try {
    // Find the user by email
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      console.error(`User not found for email: ${email}`);
      return;
    }

    // Create a notification in the database
    await prisma.notification.create({
      data: {
        userId: user.id,
        tripId: data.tripId,
        type: 'trip_invitation',
        title: 'Trip Invitation',
        message: `${data.invitedBy} invited you to join "${data.tripName}"`,
        data: {
          tripId: data.tripId,
          tripName: data.tripName,
          invitedBy: data.invitedBy,
        },
      },
    });

    // TODO: Send actual email
    // Example with a hypothetical email service:
    // await emailService.send({
    //   to: email,
    //   subject: `You're invited to ${data.tripName}`,
    //   template: 'trip-invitation',
    //   data: {
    //     tripName: data.tripName,
    //     invitedBy: data.invitedBy,
    //     acceptUrl: `${process.env.NEXT_PUBLIC_APP_URL}/trips/${data.tripId}`,
    //   },
    // });

    console.log(`Invitation notification created for ${email} to trip ${data.tripName}`);
  } catch (error) {
    console.error('Error sending invitation email:', error);
    throw error;
  }
}

/**
 * Send proposal notification email
 */
export async function sendProposalNotification(
  tripId: string,
  proposalTitle: string,
  proposedBy: string
): Promise<void> {
  try {
    // Get all active trip members
    const members = await prisma.tripMember.findMany({
      where: {
        tripId,
        status: 'active',
      },
      include: {
        user: true,
      },
    });

    // Create notifications for all members
    const notifications = members.map((member) => ({
      userId: member.userId,
      tripId,
      type: 'new_proposal',
      title: 'New Proposal',
      message: `${proposedBy} added a new proposal: ${proposalTitle}`,
      data: {
        proposalTitle,
        proposedBy,
      },
    }));

    await prisma.notification.createMany({
      data: notifications,
    });

    console.log(`Proposal notifications sent for trip ${tripId}`);
  } catch (error) {
    console.error('Error sending proposal notifications:', error);
    throw error;
  }
}

/**
 * Send expense notification email
 */
export async function sendExpenseNotification(
  tripId: string,
  expenseDescription: string,
  amount: number,
  currency: string,
  paidBy: string
): Promise<void> {
  try {
    // Get all active trip members
    const members = await prisma.tripMember.findMany({
      where: {
        tripId,
        status: 'active',
      },
    });

    // Create notifications for all members
    const notifications = members.map((member) => ({
      userId: member.userId,
      tripId,
      type: 'new_expense',
      title: 'New Expense',
      message: `${paidBy} added an expense: ${expenseDescription} - ${currency} ${amount}`,
      data: {
        expenseDescription,
        amount: amount.toString(),
        currency,
        paidBy,
      },
    }));

    await prisma.notification.createMany({
      data: notifications,
    });

    console.log(`Expense notifications sent for trip ${tripId}`);
  } catch (error) {
    console.error('Error sending expense notifications:', error);
    throw error;
  }
}
